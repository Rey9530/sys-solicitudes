import * as React from 'react';
import { cn } from '@/lib/utils';

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
);

export const TableHeader = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="border-b bg-gray-50" {...props} />
);

export const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
);

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b transition-colors hover:bg-gray-50', className)} {...props} />
);

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn('h-10 px-4 text-left align-middle text-xs font-semibold text-gray-500', className)}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 align-middle', className)} {...props} />
);
