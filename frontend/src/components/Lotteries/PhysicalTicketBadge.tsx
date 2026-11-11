import React from 'react';

interface PhysicalTicketBadgeProps {
  delivered: boolean;
  className?: string;
}

export const PhysicalTicketBadge: React.FC<PhysicalTicketBadgeProps> = ({
  delivered,
  className = '',
}) => (
  <span
    data-testid={delivered ? 'physical-ticket-delivered' : 'physical-ticket-not-delivered'}
    aria-label={delivered ? 'Papeleta física entregada' : 'Papeleta física no entregada'}
    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
      delivered ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
    } ${className}`}
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
    <span>{delivered ? 'Entregada' : 'No entregada'}</span>
  </span>
);
