import * as React from "react";
import useEmblaCarousel, { type EmblaOptionsType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type CarouselProps = React.HTMLAttributes<HTMLDivElement> & {
  opts?: EmblaOptionsType;
  setApi?: (api?: ReturnType<typeof useEmblaCarousel>[1]) => void;
  plugins?: unknown[];
};

export const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  ({ className, children, opts, setApi, plugins, ...props }, ref) => {
    const [emblaRef, api] = useEmblaCarousel(
      opts as EmblaOptionsType | undefined,
      plugins as [] | undefined,
    );
    React.useEffect(() => {
      setApi?.(api);
    }, [api, setApi]);
    return (
      <div ref={ref} className={className} {...props}>
        <div className="overflow-hidden" ref={emblaRef}>
          {children}
        </div>
      </div>
    );
  },
);
Carousel.displayName = "Carousel";

export const CarouselContent: React.FC<
  React.HTMLAttributes<HTMLDivElement>
> = ({ className, children, ...props }) => {
  return (
    <div className={`flex -ml-0 ${className ?? ""}`} {...props}>
      {React.Children.map(children, (child) => (
        <div className="min-w-0 flex-[0_0_100%] pl-0">{child}</div>
      ))}
    </div>
  );
};

export const CarouselItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={`relative ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
};

export const CarouselPrevious: React.FC<{
  onClick?: () => void;
}> = () => {
  const ctx = React.useContext(EmblaContext);
  return (
    <button
      type="button"
      aria-label="Previous"
      onClick={() => ctx?.api?.scrollPrev()}
      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center rounded-full bg-background/80 backdrop-blur border w-9 h-9 hover:bg-background"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
  );
};

export const CarouselNext: React.FC<{
  onClick?: () => void;
}> = () => {
  const ctx = React.useContext(EmblaContext);
  return (
    <button
      type="button"
      aria-label="Next"
      onClick={() => ctx?.api?.scrollNext()}
      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center rounded-full bg-background/80 backdrop-blur border w-9 h-9 hover:bg-background"
    >
      <ChevronRight className="w-5 h-5" />
    </button>
  );
};

type EmblaContextValue = { api?: ReturnType<typeof useEmblaCarousel>[1] };
const EmblaContext = React.createContext<EmblaContextValue | null>(null);

export const CarouselProvider: React.FC<{
  children: React.ReactNode;
  api?: ReturnType<typeof useEmblaCarousel>[1];
}> = ({ children, api }) => {
  return (
    <EmblaContext.Provider value={{ api }}>{children}</EmblaContext.Provider>
  );
};
