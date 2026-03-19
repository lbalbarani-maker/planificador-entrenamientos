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
  const [debug, setDebug] = useState<string>("");
  const idCounter = useRef(Date.now());
  const seenDbIdsRef = useRef<Set<string>>(new Set());
  const lastSeenTimestampRef = useRef<string>("1970-01-01T00:00:00.000Z");

  useImperativeHandle(ref, () => ({
    addReaction: (type: string) => {
      const id = idCounter.current++;
      setReactions((prev) => [...prev, { id, type }]);
      setDebug(`Local reaction: ${type} (id: ${id})`);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    },
  }));

  useEffect(() => {
    if (!matchId) return;

    setDebug(`Polling started for: ${matchId}`);

    const pollReactions = async () => {
      try {
        const { data, error } = await supabase
          .from("match_reactions")
          .select("id, type, created_at")
          .eq("match_id", matchId)
          .gt("created_at", lastSeenTimestampRef.current)
          .order("created_at", { ascending: true });

        if (error) {
          setDebug(`Error: ${error.message}`);
          return;
        }

        if (data && data.length > 0) {
          setDebug(`Found ${data.length} reactions: ${JSON.stringify(data.map(r => r.type))}`);
          
          data.forEach((reaction: any) => {
            if (!seenDbIdsRef.current.has(reaction.id)) {
              seenDbIdsRef.current.add(reaction.id);
              lastSeenTimestampRef.current = reaction.created_at;
              
              const localId = idCounter.current++;
              setReactions((prev) => [...prev, { id: localId, type: reaction.type }]);
              setDebug(`Showing reaction from DB: ${reaction.type}`);

              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== localId));
              }, 3000);
            }
          });
        } else {
          setDebug(`No new reactions. Last seen: ${lastSeenTimestampRef.current.substring(0, 19)}`);
        }
      } catch (e: any) {
        setDebug(`Exception: ${e.message}`);
      }
    };

    pollReactions();
    const interval = setInterval(pollReactions, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [matchId]);

  return (
    <>
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
      <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50 max-w-[200px]">
        {debug}
      </div>
    </>
  );
});

FloatingReactions.displayName = "FloatingReactions";

export default FloatingReactions;
