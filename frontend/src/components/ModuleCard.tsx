import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

export default function ModuleCard({ icon, title, description, onClick }: Props) {
  return (
    <button onClick={onClick} className="touch-card text-left">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-agri-100 text-agri-700">
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-agri-700">
        Open <ArrowRight size={16} />
      </div>
    </button>
  );
}
