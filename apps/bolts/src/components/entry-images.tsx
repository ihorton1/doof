"use client";

import React, { useState } from "react";
import Image from "next/image";
import { entryImagePath } from "../lib/entry-images";

function EntryImage({ id, index }: { id: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="entry-image-error">
        <p role="alert" className="form-error">Image {index + 1} could not be loaded. Try again, or sign in again.</p>
        <button type="button" className="button button-secondary" onClick={() => setFailed(false)}>Try loading image</button>
      </div>
    );
  }
  return (
    <a className="entry-image-link" href={entryImagePath(id)} target="_blank" rel="noopener noreferrer">
      <Image
        src={entryImagePath(id)}
        alt={`Image ${index + 1} attached to this entry (opens full size)`}
        width={1200}
        height={900}
        unoptimized
        loading="lazy"
        className="entry-image"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

export function EntryImages({ images, compact = false }: { images: { id: string }[]; compact?: boolean }) {
  if (images.length === 0) return null;
  return (
    <div className={`entry-images${compact ? " entry-images-compact" : ""}`}>
      {images.map((image, index) => <EntryImage key={image.id} id={image.id} index={index} />)}
    </div>
  );
}
