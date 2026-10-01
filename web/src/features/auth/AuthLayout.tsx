import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { BrandMark } from '@/app/layout/BrandMark';
import { Card } from '@/shared/ui/Card';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 py-10 sm:items-center">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <Link to="/editais" className="mb-6 inline-flex" aria-label="Portal PIBIC, página inicial">
          <BrandMark />
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        <div className="mt-6 space-y-4">{children}</div>
        <p className="mt-6 border-t border-line pt-4 text-center text-sm text-ink-muted">{footer}</p>
      </Card>
    </div>
  );
}
