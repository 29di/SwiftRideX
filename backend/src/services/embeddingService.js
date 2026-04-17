const DEFAULT_DIMENSIONS = 48;

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const hashToken = (token) => {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const normalizeVector = (vector) => {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
};

const createTextEmbedding = (text, dimensions = DEFAULT_DIMENSIONS) => {
  const vector = new Array(Math.max(8, Number(dimensions) || DEFAULT_DIMENSIONS)).fill(0);
  const tokens = tokenize(text);

  if (!tokens.length) {
    return vector;
  }

  for (const token of tokens) {
    const hash = hashToken(token);
    const bucket = hash % vector.length;
    vector[bucket] += 1;
  }

  return normalizeVector(vector);
};

const cosineSimilarity = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
  }

  return Number.isFinite(dot) ? dot : 0;
};

module.exports = {
  createTextEmbedding,
  cosineSimilarity,
};
