import React from "react";

interface TitleProps {
  size?: string;
  className?: string;
  children: React.ReactNode;
}

const sizeClassMap: Record<string, string> = {
  md: "text-2xl font-semibold text-white",
  sm: "text-xl font-medium",
};

const Title = ({ children, size = "md", className = "" }: TitleProps) => {
  const sizeClassName = sizeClassMap[size] ?? sizeClassMap.md;

  return (
    <div className={`${sizeClassName} ${className} `.trim()}>{children}</div>
  );
};

export default Title;
