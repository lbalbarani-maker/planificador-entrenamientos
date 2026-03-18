import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabase";

export interface FloatingReactionsRef {
  addReaction: (type: string) => void;
}

interface FloatingReactionsProps {
  matchId: string;
}

export interface Reaction {
  id: number;
  type: string;
}

const icons: Record<string, string> = {
  clap: "👏",
  heart: "❤️",
  fire: "🔥",
  muscle: "💪",
};

const FloatingReactions = forwardRef<FloatingReactionsRef, FloatingReactionsProps>(({ matchId }, ref) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const idCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    addReaction: (type: string) => {
      const id = idCounter.current++;
      setReactions((prev) => [...prev, { id, type }]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    },
  }));

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel("reactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_reactions",
          filter: `match_id=eq.${matchId}`,
        },
        (payload: any) => {
          const id = idCounter.current++;
          setReactions((prev) => [...prev, { id, type: payload.new.type }]);

          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== id));
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return (
    <div className="fixed bottom-20 right-4 pointer-events-none z-40">
      {reactions.map((r) => (
        <motion.div
          key={r.id}
          initial={{ y: 0, opacity: 1, x: 0 }}
          animate={{ y: -200, opacity: 0, x: Math.random() * 40 - 20 }}
          transition={{ duration: 3, ease: "easeOut" }}
          className="text-4xl mb-2"
        >
          {icons[r.type] || "❓"}
        </motion.div>
      ))}
    </div>
  );
});

FloatingReactions.displayName = "FloatingReactions";

export default FloatingReactions;
