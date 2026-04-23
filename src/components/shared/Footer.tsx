import { BUILD_COMMIT, BUILD_TIME } from "@/lib/build-info";

interface FooterProps {
  variant?: "app" | "login";
}

export function Footer({ variant = "app" }: FooterProps) {
  const inner = (
    <>
      version #{BUILD_COMMIT} &middot; {BUILD_TIME} &middot; con&ccedil;u par{" "}
      <a
        href="https://coachdigitalparis.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-text-primary transition-colors"
      >
        G.KORZEC
      </a>
    </>
  );

  if (variant === "login") {
    return (
      <p className="text-center text-text-muted/40 text-[10px] mt-10 tracking-wide">
        {inner}
      </p>
    );
  }

  return (
    <footer className="shrink-0 border-t border-border-subtle bg-surface-0 py-1 text-center">
      <span className="text-[10px] text-text-muted tracking-wide">
        {inner}
      </span>
    </footer>
  );
}
