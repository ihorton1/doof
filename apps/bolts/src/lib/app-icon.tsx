import { ImageResponse } from "next/og";
import React from "react";

export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e242c",
          color: "#facc15",
          fontSize: size * 0.6,
          fontWeight: 700,
        }}
      >
        B
      </div>
    ),
    { width: size, height: size },
  );
}
