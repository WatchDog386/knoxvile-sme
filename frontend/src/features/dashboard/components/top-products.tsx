import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { DashboardData } from '@/api/types';
import { EmptyState } from '@/components/ui/empty-state';
import { formatKES } from '@/lib/utils';

const productImages = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1563178406-4cdc2923acbc?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=400&q=80',
];

function getProductImage(name: string, index: number) {
  const lower = name.toLowerCase();
  if (lower.includes('shoe') || lower.includes('sneaker') || lower.includes('boot')) return productImages[2];
  if (lower.includes('phone') || lower.includes('watch') || lower.includes('gadget') || lower.includes('tech')) return productImages[0];
  if (lower.includes('audio') || lower.includes('headphone') || lower.includes('speaker')) return productImages[1];
  if (lower.includes('camera') || lower.includes('photo')) return productImages[3];
  if (lower.includes('med') || lower.includes('pill') || lower.includes('health')) return productImages[4];
  if (lower.includes('drink') || lower.includes('coffee') || lower.includes('tea') || lower.includes('juice')) return productImages[5];
  if (lower.includes('glass') || lower.includes('sunglass')) return productImages[6];
  return productImages[index % productImages.length];
}

export function TopProducts({
  products,
}: {
  products: DashboardData['topProducts'];
}) {
  const displayProducts = products.length > 0 ? [...products, ...products, ...products] : [];

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-medium tracking-tight text-foreground">
          Top sellers — last 30 days
        </h2>
        <Link to="/products" className="text-xs font-medium text-accent hover:text-accent-strong">
          See All
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Trophy}
            title="No sales yet"
            description="Your best-selling products and services will appear here."
          />
        </div>
      ) : (
        <div className="relative w-full overflow-hidden py-1">
          <div className="animate-marquee flex gap-4">
            {displayProducts.map((product, index) => {
              const originalIndex = index % products.length;
              return (
                <div
                  key={`${product.name}-${index}`}
                  className="flex flex-col min-w-[130px] max-w-[140px] shrink-0"
                >
                  <div className="relative h-28 w-full rounded-2xl overflow-hidden shadow-sm bg-surface-2">
                    <img
                      src={getProductImage(product.name, originalIndex)}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-medium text-white shadow">
                      {originalIndex + 1}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs font-medium text-foreground">
                    {product.name}
                  </p>
                  <p className="text-[10px] text-foreground-5">
                    {Number(product.quantity)} sold
                  </p>
                  <p className="text-xs font-medium text-foreground mt-0.5">
                    {formatKES(Number(product.revenue))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}