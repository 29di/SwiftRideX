import { MessageCircle, SendHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocketRealtime } from '../../hooks/useSocketRealtime';
import { chatService } from '../../services/chatService';
import { rideService } from '../../services/rideService';
import Button from '../ui/Button';

const ACTIVE_STATUSES = new Set(['REQUESTED', 'ACCEPTED', 'STARTED']);
const ACTIVE_RIDE_KEY = 'swiftridex_active_ride';

const readActiveRideFromStorage = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_RIDE_KEY);
    if (!raw) {
      return null;
    }

    const ride = JSON.parse(raw);
    const status = String(ride?.status || '').toUpperCase();
    return ACTIVE_STATUSES.has(status) ? ride : null;
  } catch {
    return null;
  }
};

const mergeMessagesById = (current, incoming) => {
  const map = new Map(current.map((item) => [String(item.id), item]));
  for (const nextItem of incoming) {
    map.set(String(nextItem.id), nextItem);
  }
  return Array.from(map.values()).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
};

const formatMessageTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function RideChatWidget() {
  const { session } = useAuth();
  const { socket, latestRideEvent } = useSocketRealtime();

  const [activeRide, setActiveRide] = useState(() => readActiveRideFromStorage());
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingQuickReplies, setLoadingQuickReplies] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const role = session?.role;
  const userId = String(session?.user?.id || '');
  const rideId = activeRide?.id ? String(activeRide.id) : '';
  const rideStatus = String(activeRide?.status || '').toUpperCase();
  const isEligibleRole = role === 'rider' || role === 'driver';

  const isChatAvailable = useMemo(() => {
    if (!isEligibleRole || !rideId || !ACTIVE_STATUSES.has(rideStatus)) {
      return false;
    }

    if (role === 'rider') {
      return Boolean(activeRide?.driverId);
    }

    return true;
  }, [activeRide?.driverId, isEligibleRole, rideId, rideStatus, role]);

  const resolveActiveRide = useCallback(async () => {
    if (!isEligibleRole) {
      setActiveRide(null);
      return;
    }

    try {
      const response = role === 'driver'
        ? await rideService.getActiveRideForDriver()
        : await rideService.getActiveRideForRider();

      const nextRide = response?.ride || null;
      setActiveRide(nextRide);
    } catch {
      setActiveRide(role === 'rider' ? readActiveRideFromStorage() : null);
    }
  }, [isEligibleRole, role]);

  const loadMessages = useCallback(async () => {
    if (!isChatAvailable || !rideId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    setError('');

    try {
      const response = await chatService.getRideMessages(rideId, { limit: 80 });
      setMessages(Array.isArray(response?.messages) ? response.messages : []);
    } catch (nextError) {
      setError(nextError.message || 'Unable to load chat messages');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [isChatAvailable, rideId]);

  useEffect(() => {
    resolveActiveRide();
  }, [resolveActiveRide]);

  useEffect(() => {
    if (!latestRideEvent?.payload?.rideId) {
      return;
    }

    const payload = latestRideEvent.payload;
    const payloadRideId = String(payload.rideId || '');

    const payloadStatus = String(payload.status || '').toUpperCase();
    const belongsToCurrentUser =
      (role === 'rider' && payload?.riderId && String(payload.riderId) === userId) ||
      (role === 'driver' && payload?.driverId && String(payload.driverId) === userId);

    if (belongsToCurrentUser && ACTIVE_STATUSES.has(payloadStatus)) {
      setActiveRide((current) => {
        if (!current || String(current.id) === payloadRideId) {
          return {
            ...(current || {}),
            ...payload,
            id: payloadRideId,
            status: payload.status || current?.status,
          };
        }

        return current;
      });
    }

    if (!rideId || payloadRideId !== rideId) {
      return;
    }

    if (payloadStatus === 'COMPLETED' || payloadStatus === 'CANCELLED') {
      setActiveRide(null);
      setMessages([]);
      setIsOpen(false);
      setUnreadCount(0);
    }
  }, [latestRideEvent, rideId, role, userId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!socket || !rideId) {
      return undefined;
    }

    const onChatMessage = (payload) => {
      if (!payload?.rideId || String(payload.rideId) !== rideId) {
        return;
      }

      setMessages((current) => mergeMessagesById(current, [payload]));

      if (!isOpen && String(payload.senderRole || '') !== role) {
        setUnreadCount((current) => current + 1);
      }
    };

    socket.on('ride-chat-message', onChatMessage);
    return () => {
      socket.off('ride-chat-message', onChatMessage);
    };
  }, [isOpen, rideId, role, socket]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setUnreadCount(0);
  }, [isOpen]);

  const latestContextText = useMemo(() => {
    const typed = inputMessage.trim();
    if (typed) {
      return typed;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (String(candidate.senderRole || '') !== role && candidate.text) {
        return candidate.text;
      }
    }

    return '';
  }, [inputMessage, messages, role]);

  useEffect(() => {
    if (!isOpen || !isChatAvailable || !rideId) {
      setQuickReplies([]);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoadingQuickReplies(true);
      try {
        const response = await chatService.getQuickReplies(rideId, {
          context: latestContextText,
          limit: 6,
        });
        setQuickReplies(Array.isArray(response?.quickReplies) ? response.quickReplies : []);
      } catch {
        setQuickReplies([]);
      } finally {
        setLoadingQuickReplies(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isChatAvailable, isOpen, latestContextText, rideId]);

  const handleSendMessage = async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || !rideId || !isChatAvailable) {
      return;
    }

    setSendingMessage(true);
    setError('');

    try {
      const response = await chatService.sendRideMessage(rideId, { text: trimmed });
      const sent = response?.message;
      if (sent) {
        setMessages((current) => mergeMessagesById(current, [sent]));
      }
      setInputMessage('');
    } catch (nextError) {
      setError(nextError.message || 'Unable to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  if (!isEligibleRole || !activeRide?.id || !ACTIVE_STATUSES.has(rideStatus)) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-brand-300/40 bg-brand-500/90 text-white shadow-xl shadow-brand-600/30 transition hover:scale-105 hover:bg-brand-400"
          aria-label="Open ride chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Ride chat</div>
              <div className="mt-1 text-sm font-semibold text-white">Ride #{rideId}</div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-white/15 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close ride chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isChatAvailable ? (
            <div className="p-4 text-sm text-slate-300">Chat will be available once the driver is assigned to this ride.</div>
          ) : (
            <>
              <div className="h-72 overflow-y-auto px-4 py-3">
                {loadingMessages ? (
                  <div className="text-sm text-slate-400">Loading chat...</div>
                ) : messages.length ? (
                  <div className="grid gap-2">
                    {messages.map((message) => {
                      const mine = String(message.senderRole || '') === role && String(message.senderId || '') === userId;
                      return (
                        <div
                          key={message.id}
                          className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? 'ml-auto border border-brand-400/40 bg-brand-500/20 text-white'
                              : 'mr-auto border border-white/10 bg-white/5 text-slate-100'
                          }`}
                        >
                          <div className="leading-5">{message.text}</div>
                          <div className={`mt-1 text-[10px] ${mine ? 'text-brand-200' : 'text-slate-400'}`}>{formatMessageTime(message.createdAt)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">No messages yet. Start with a quick message.</div>
                )}
              </div>

              <div className="border-t border-white/10 px-3 py-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {loadingQuickReplies ? (
                    <span className="text-xs text-slate-500">Ranking quick replies...</span>
                  ) : (
                    quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => setInputMessage(reply)}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                      >
                        {reply}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={inputMessage}
                    onChange={(event) => setInputMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    maxLength={1000}
                    placeholder="Type a message..."
                    className="field-input h-11"
                    disabled={sendingMessage}
                  />
                  <Button onClick={handleSendMessage} disabled={sendingMessage || !inputMessage.trim()}>
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
