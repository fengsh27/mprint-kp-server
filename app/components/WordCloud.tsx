'use client';

import React, { useEffect, useRef } from "react";

type WordCloudEntry = [string, number];

type WordCloudProps = {
  words: WordCloudEntry[];
  height?: number;
  theme?: "green" | "blue" | "orange";
};

const PALETTES: Record<NonNullable<WordCloudProps["theme"]>, string[]> = {
  blue: ["#4E79A7", "#5E85B8", "#3E6582", "#2E4E62"],
  orange: ["#F28E2B", "#F4A65A", "#F7C788", "#D77A1B"],
  green: ["#70AD47", "#80BB59", "#588938", "#42662A"]
};

const getRandomColor = (theme: WordCloudProps["theme"]) => {
  const palette = PALETTES[theme ?? "green"];
  return palette[Math.floor(Math.random() * palette.length)];
};

export default function WordCloud({ words, height = 320, theme = "green" }: WordCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas || words.length === 0) return;
      const maxCount = Math.max(...words.map((entry) => entry[1] || 0), 0);
      const scaledWords: WordCloudEntry[] =
        maxCount > 0
          ? words.map(([term, count]) => [
              term,
              Math.max(1, Math.round((count / maxCount) * 50))
            ])
          : words;

      const container = canvas.parentElement;
      const width = container?.clientWidth ?? 300;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const module = await import("wordcloud");
      if (!isMounted) return;
      const WordCloud = (module as any).default ?? module;

      WordCloud(canvas, {
        list: scaledWords,
        backgroundColor: "white",
        gridSize: 12,
        weightFactor: (size: number) => Math.max(8, Math.min(size * 1.2, 40)),
        minRotation: 0,
        maxRotation: 0,
        rotateRatio: 0,
        color: () => getRandomColor(theme),
        drawOutOfBound: false,
        shrinkToFit: true
      });
    };

    render();
    const onResize = () => render();
    window.addEventListener("resize", onResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", onResize);
    };
  }, [words, height, theme]);

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No terms available
      </div>
    );
  }

  return <canvas ref={canvasRef} />;
}
