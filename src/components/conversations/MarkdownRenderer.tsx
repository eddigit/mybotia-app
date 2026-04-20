"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-accent-glow mt-4 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] font-semibold text-accent-glow mt-3 mb-1.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[13px] font-medium text-text-primary mt-2.5 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-text-primary leading-relaxed mb-2 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-text-secondary italic">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-primary hover:text-accent-glow underline underline-offset-2 decoration-accent-primary/30 transition-colors"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1 my-2 pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1 my-2 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-text-primary leading-relaxed relative pl-2 before:content-[''] before:absolute before:left-[-12px] before:top-[9px] before:w-[4px] before:h-[4px] before:rounded-full before:bg-accent-primary/50">
      {children}
    </li>
  ),
  hr: () => (
    <div className="my-3 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent-primary/40 pl-3 my-2 text-text-secondary italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="my-2 p-3 bg-surface-3/60 border border-border-subtle rounded text-xs font-mono text-text-primary overflow-x-auto">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="px-1.5 py-0.5 bg-surface-3/50 border border-border-subtle rounded text-xs font-mono text-accent-glow">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-3/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-default">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-sm text-text-primary border-b border-border-subtle">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-surface-3/30 transition-colors">{children}</tr>
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
