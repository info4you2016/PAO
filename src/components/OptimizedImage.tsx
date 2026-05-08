import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'motion/react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface OptimizedImageProps extends HTMLMotionProps<'img'> {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'auto' | 'portrait';
}

/**
 * OptimizedImage component handles:
 * 1. Native Lazy Loading
 * 2. Unsplash URL Optimization (Automatic compression/formatting)
 * 3. Loading skeletons
 * 4. Smooth fade-in transitions
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({ 
  src, 
  alt, 
  className, 
  aspectRatio = 'video',
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Optimize Unsplash URLs if detected
  const optimizedSrc = React.useMemo(() => {
    if (!src) return src;
    
    if (src.includes('unsplash.com')) {
      const url = new URL(src);
      // Ensure we use auto format (WebP/AVIF) and good compression
      url.searchParams.set('auto', 'format,compress');
      url.searchParams.set('q', '75'); // High quality but compressed
      
      // Responsive sizing based on standard slide usage
      if (!url.searchParams.has('w')) {
        url.searchParams.set('w', '1200');
      }
      
      return url.toString();
    }
    
    return src;
  }, [src]);

  const aspectRatioClass = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
    auto: '',
  }[aspectRatio];

  return (
    <div className={cn(
      "relative overflow-hidden bg-slate-100 rounded-xl transition-all duration-500",
      aspectRatioClass,
      className
    )}>
      <AnimatePresence>
        {!isLoaded && !error && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-slate-50"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chargement...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 p-4">
          <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Image indisponible</span>
        </div>
      ) : (
        <motion.img
          src={optimizedSrc}
          alt={alt}
          loading="lazy" // Native Lazy Loading
          decoding="async" // Async decoding for better performance
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ 
            opacity: isLoaded ? 1 : 0, 
            scale: isLoaded ? 1 : 1.05 
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "w-full h-full object-cover",
            !isLoaded && "invisible"
          )}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};
