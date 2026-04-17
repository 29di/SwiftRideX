import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4">
      <Card className="w-full text-center">
        <div className="section-label">Not found</div>
        <h1 className="mt-4 text-4xl font-bold text-white">This route does not exist</h1>
        <p className="mt-4 text-slate-400">Use the navigation or head back to your dashboard.</p>
        <div className="mt-6 flex justify-center">
          <Link to="/auth">
            <Button>Go to auth</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
