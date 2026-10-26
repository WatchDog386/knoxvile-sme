import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WelcomeBanner() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-accent p-5 text-white shadow-sm sm:p-6">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" aria-hidden />
      <div className="absolute right-16 -bottom-10 h-24 w-24 rounded-full bg-white/5" aria-hidden />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-white/80" aria-hidden />
          <p className="text-sm font-medium uppercase tracking-wide text-white/80">
            Welcome!
          </p>
        </div>
        <h2 className="text-lg font-medium sm:text-xl">
          Your business is set up. Now let's make your first sale.
        </h2>
        <p className="max-w-lg text-sm text-white/80">
          Add your products and services, then record a sale — the dashboard
          updates with your revenue, costs and profit instantly.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => navigate('/products?new=1')} className="bg-white text-accent hover:bg-white/90">
            Add a product
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/services?new=1')}
            className="border-white/40 bg-transparent text-white hover:bg-white/10"
          >
            Add a service
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/sales/new')}
            className="text-white hover:bg-white/10"
          >
            Record a sale →
          </Button>
        </div>
      </div>
    </div>
  );
}