import { useNavigate } from 'react-router-dom';
import { AppBar } from '@/components/layout/app-bar';
import { notifySuccess } from '@/components/ui/popup-host';
import { ExpenseForm } from './expense-form';

/**
 * What an employee gets at /expenses: the form to submit an expense for approval and nothing
 * else. Expense lists, totals and details are for admins.
 */
export function EmployeeExpensePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <AppBar title="Submit expense" />
      <div className="rounded-[24px] border border-edge bg-surface p-4">
        <ExpenseForm
          onClose={() => navigate('/dashboard')}
          onSaved={() => notifySuccess('Expense sent', 'Your manager will approve or reject it.')}
          submitLabel="Send for approval"
        />
      </div>
    </div>
  );
}
