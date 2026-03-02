import React from "react";

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  gradient,
  iconBg,
}) => {
  return (
    <div
      className={`bg-gradient-to-br ${gradient} p-6 rounded-xl hover:shadow-lg transition-all duration-200`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight mt-2">{value}</p>
        </div>
        <div className={`p-3 ${iconBg} rounded-xl`}>{icon}</div>
      </div>
    </div>
  );
};

export default StatCard;
