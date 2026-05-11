"use client";

import { useEffect, useRef, useState } from "react";

export function EditableTitle({
  initial,
  onSave,
  className = "",
  inputClassName = "",
}: {
  initial: string;
  onSave: (next: string) => Promise<unknown> | unknown;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    const next = value.trim();
    setEditing(false);
    if (next && next !== initial) {
      await onSave(next);
    } else {
      setValue(initial);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue(initial);
            setEditing(false);
          }
        }}
        className={`bg-white border border-zinc-300 rounded px-1 outline-none ${inputClassName}`}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Double-click to rename"
      className={`cursor-text truncate ${className}`}
    >
      {value}
    </span>
  );
}
