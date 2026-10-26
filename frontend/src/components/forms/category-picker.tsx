import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { categoriesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { CategoryType } from '@/api/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useRole } from '@/hooks/use-role';
import { cn } from '@/lib/utils';

/** What a picked category is called in the "new" prompt and the empty option. */
const NOUN: Record<CategoryType, string> = {
  SALE: 'sales category',
  EXPENSE: 'expense category',
  PRODUCT: 'product category',
  SERVICE: 'service category',
};

/**
 * Category dropdown with "+ New category": type a name and it is added for
 * the whole business and picked straight away. Admins and managers can add
 * categories (as the server allows); everyone else picks from the list.
 */
export function CategoryPicker({
  type,
  value,
  onChange,
  id = `category-${type.toLowerCase()}`,
  label = 'Category',
  labelClassName,
  selectClassName,
  dark = false,
}: {
  type: CategoryType;
  value: string;
  onChange: (categoryId: string) => void;
  id?: string;
  label?: string;
  labelClassName?: string;
  selectClassName?: string;
  dark?: boolean;
}) {
  const queryClient = useQueryClient();
  const { canManage } = useRole();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories', type], queryFn: () => categoriesApi.list(type) });

  const create = useMutation({
    mutationFn: () => categoriesApi.create({ name: name.trim(), type }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['categories', type] });
      onChange(category.id);
      setAdding(false);
      setName('');
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const save = () => {
    if (name.trim().length < 2) {
      setError('Enter a name of at least 2 letters.');
      return;
    }
    create.mutate();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className={labelClassName}>
          {label}
        </Label>
        {canManage && !adding && (
          <button
            type="button"
            data-keep-color
            onClick={() => setAdding(true)}
            className={cn(
              'mb-1 inline-flex items-center gap-1 text-[12px] font-semibold',
              dark ? 'text-[#9BD84F]' : 'text-brand-600',
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> New category
          </button>
        )}
      </div>

      {adding ? (
        <div className="flex gap-2">
          <Input
            id={id}
            autoFocus
            value={name}
            maxLength={120}
            placeholder={`New ${NOUN[type]}, e.g. ${type === 'SALE' ? 'Installation' : 'Transport'}`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
              if (e.key === 'Escape') setAdding(false);
            }}
            className={selectClassName}
          />
          <button
            type="button"
            data-keep-color
            onClick={save}
            disabled={create.isPending}
            className="h-11 shrink-0 rounded-full bg-gradient-to-b from-[#8BC53F] to-[#6C9E2A] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {create.isPending ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            data-keep-color
            aria-label="Cancel"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            className={cn('h-11 shrink-0 rounded-full px-2', dark ? 'text-white/70' : 'text-foreground-4')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : (
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClassName}
        >
          <option value="">No category</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
