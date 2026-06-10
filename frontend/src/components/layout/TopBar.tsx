import React from 'react';

interface TopBarProps {
  title: string;
  action?: React.ReactNode;
}

export default function TopBar({ title, action }: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  );
}
