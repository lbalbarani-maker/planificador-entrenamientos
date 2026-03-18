import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect, useState } from "react";

type EventType = "goal" | "save" | "rival_goal";

interface Props {
  event: EventType | null;
  eventTeam: "team1" | "team2" | null;
  match: any;
  onFinish: () => void;
}

export default function MatchEventOverlay({ event, eventTeam, match, onFinish }: Props) {
  const [lastGoal, setLastGoal] = useState<{player_name?: string; dorsal?: string; quarter?: number} | null>(null);

  useEffect(() => {
    if (!event) return;

    if (event === "goal" || event === "rival_goal") {
      confetti({
        particleCount: 150,
        spread: 70,
        colors: eventTeam === "team1" 
          ? [match?.team1_color || "#D32F2F"] 
          : [match?.team2_color || "#1976D2"]
      });
    }

    const timer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, [event, eventTeam]);

  const getConfig = () => {
    switch (event) {
      case "goal":
        return {
          text: "🏑 ¡GOOOOL!",
          subtext: lastGoal?.player_name 
            ? `${lastGoal.player_name}${lastGoal.dorsal ? ` #${lastGoal.dorsal}` : ''}`
            : null,
          bg: "bg-gradient-to-r from-green-600 to-green-500",
          emoji: "🎉"
        };
      case "save":
        return {
          text: "🧤 ¡PARADÓN!",
          subtext: null,
          bg: "bg-gradient-to-r from-blue-600 to-blue-500",
          emoji: "🧤"
        };
      case "rival_goal":
        return {
          text: "😬 Gol del rival… ¡Vamos equipo!",
          subtext: lastGoal?.player_name 
            ? `${lastGoal.player_name}${lastGoal.dorsal ? ` #${lastGoal.dorsal}` : ''}`
            : null,
          bg: "bg-gradient-to-r from-red-600 to-red-500",
          emoji: "💪"
        };
      default:
        return null;
    }
  };

  const config = getConfig();
  if (!event || !config) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 flex flex-col items-center justify-center text-white ${config.bg}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{ zIndex: 9999 }}
      >
        <motion.div
          initial={{ scale: 0.5, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <div className="text-8xl mb-4">{config.emoji}</div>
          <motion.h1
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-6xl md:text-8xl font-black drop-shadow-2xl mb-2"
          >
            {config.text}
          </motion.h1>
          {config.subtext && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-4xl font-bold text-white/90"
            >
              {config.subtext}
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
