import { useCallback, useEffect, useRef, useState } from 'react';

interface WindowPerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: WindowPerformanceMemory;
}

export interface PerformanceMetrics {
  usedMemoryMb: number | null;
  totalMemoryMb: number | null;
  memoryLimitMb: number | null;
  renderTimeMs: number;
  fps: number;
  domNodes: number;
  viewportWidth: number;
  viewportHeight: number;
  isHealthy: boolean;
}

interface ReadMemoryResult {
  usedMemoryMb: number | null;
  totalMemoryMb: number | null;
  memoryLimitMb: number | null;
}

function readSafeMemoryMetrics(): ReadMemoryResult {
  if (typeof window === 'undefined' || !window.performance) {
    return { usedMemoryMb: null, totalMemoryMb: null, memoryLimitMb: null };
  }

  const perf = window.performance as PerformanceWithMemory;
  const memory = perf.memory;

  if (
    !memory ||
    typeof memory.usedJSHeapSize !== 'number' ||
    !Number.isFinite(memory.usedJSHeapSize)
  ) {
    return { usedMemoryMb: null, totalMemoryMb: null, memoryLimitMb: null };
  }

  const bytesToMb = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(1));

  return {
    usedMemoryMb: bytesToMb(memory.usedJSHeapSize),
    totalMemoryMb:
      typeof memory.totalJSHeapSize === 'number' && Number.isFinite(memory.totalJSHeapSize)
        ? bytesToMb(memory.totalJSHeapSize)
        : null,
    memoryLimitMb:
      typeof memory.jsHeapSizeLimit === 'number' && Number.isFinite(memory.jsHeapSizeLimit)
        ? bytesToMb(memory.jsHeapSizeLimit)
        : null,
  };
}

export function usePerformanceMonitor(sampleIntervalMs = 1000) {
  const mountTimeRef = useRef<number>(
    typeof window !== 'undefined' && window.performance ? window.performance.now() : 0
  );

  const [metrics, setMetrics] = useState<PerformanceMetrics>(() => {
    const memory = readSafeMemoryMetrics();
    return {
      ...memory,
      renderTimeMs: 0,
      fps: 60,
      domNodes: typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
      isHealthy: true,
    };
  });

  const commitMetrics = useCallback((renderTimeMs: number, fps: number) => {
    const memory = readSafeMemoryMetrics();
    const domNodes = typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

    setMetrics({
      ...memory,
      renderTimeMs,
      fps,
      domNodes,
      viewportWidth,
      viewportHeight,
      isHealthy: fps >= 30 && renderTimeMs <= 33.3 && (memory.usedMemoryMb === null || memory.usedMemoryMb < 350),
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    let rafId = 0;
    let firstPaintMeasured = false;
    let windowStart = window.performance.now();
    let frameCount = 0;

    const measureFrame = (frameTimestamp: number) => {
      // Uses high-resolution performance.now() for real-time frame/render timing
      const now = window.performance.now();

      if (!firstPaintMeasured) {
        firstPaintMeasured = true;
        const initialRenderMs = Math.max(0.1, Number((now - mountTimeRef.current).toFixed(2)));
        commitMetrics(initialRenderMs, 60);
        windowStart = now;
        frameCount = 0;
      } else if (!document.hidden) {
        frameCount += 1;
        const elapsed = now - windowStart;

        if (elapsed >= sampleIntervalMs && frameCount > 0) {
          const avgFrameMs = Math.max(0.1, Number((elapsed / frameCount).toFixed(2)));
          const currentFps = Math.max(1, Math.min(240, Math.round((frameCount * 1000) / elapsed)));
          commitMetrics(avgFrameMs, currentFps);
          windowStart = now;
          frameCount = 0;
        }
      } else {
        // Reset accumulation window while tab is hidden to avoid skewed spikes
        windowStart = frameTimestamp || now;
        frameCount = 0;
      }

      rafId = window.requestAnimationFrame(measureFrame);
    };

    const handleVisibilityOrResize = () => {
      windowStart = window.performance.now();
      frameCount = 0;
      if (!document.hidden) {
        setMetrics((prev) => ({
          ...prev,
          ...readSafeMemoryMetrics(),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }));
      }
    };

    rafId = window.requestAnimationFrame(measureFrame);
    window.addEventListener('resize', handleVisibilityOrResize);
    document.addEventListener('visibilitychange', handleVisibilityOrResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleVisibilityOrResize);
      document.removeEventListener('visibilitychange', handleVisibilityOrResize);
    };
  }, [commitMetrics, sampleIntervalMs]);

  const refresh = useCallback(() => {
    if (typeof window === 'undefined' || !window.performance) return;
    const start = window.performance.now();
    window.requestAnimationFrame(() => {
      const renderMs = Math.max(0.1, Number((window.performance.now() - start).toFixed(2)));
      const instantFps = Math.max(1, Math.min(240, Math.round(1000 / renderMs)));
      commitMetrics(renderMs, instantFps);
    });
  }, [commitMetrics]);

  return { metrics, refresh };
}
