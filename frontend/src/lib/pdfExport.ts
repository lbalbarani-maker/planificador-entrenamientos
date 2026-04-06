import { jsPDF } from 'jspdf';
import { HockeyMatch, HockeyGoal, HockeySave, HockeyCard, HockeyPenaltyMiss, HockeyShootout } from '../types/hockey';

interface PDFData {
  match: HockeyMatch;
  goals: HockeyGoal[];
  saves: HockeySave[];
  cards: HockeyCard[];
  penaltyMisses: HockeyPenaltyMiss[];
  shootouts: HockeyShootout[];
}

export const generateMatchPDF = async (data: PDFData): Promise<void> => {
  const { match, goals, saves, cards, penaltyMisses, shootouts } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  const lineHeight = 7;
  const margin = 15;
  
  // Colores
  const primaryColor: [number, number, number] = [30, 64, 175];
  const textColor: [number, number, number] = [0, 0, 0];
  const grayColor: [number, number, number] = [100, 100, 100];
  
  // Helper para centrar texto
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };
  
  // Encabezado
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  centerText('ACTA DEL PARTIDO', 22, 24);
  
  y = 50;
  doc.setTextColor(...textColor);
  
  // Información del partido
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTIDO', margin, y);
  y += 10;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  // Equipos y resultado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const team1Text = match.team1_name;
  const team2Text = match.team2_name;
  const score1 = match.score_team1.toString();
  const score2 = match.score_team2.toString();
  
  doc.text(team1Text, margin, y);
  doc.text(score1, pageWidth / 2 - 15, y);
  doc.text('-', pageWidth / 2, y);
  doc.text(score2, pageWidth / 2 + 10, y);
  const team2Width = doc.getTextWidth(team2Text);
  doc.text(team2Text, pageWidth - margin - team2Width, y);
  y += 15;
  
  // Fecha
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const date = new Date(match.created_at);
  const dateStr = date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Fecha: ${dateStr}`, margin, y);
  y += 10;
  
  // Estado del partido
  const statusText = match.status === 'finished' ? 'Finalizado' : 
                     match.status === 'active' ? 'En juego' : 
                     match.status === 'paused' ? 'Pausado' : 'Pendiente';
  doc.text(`Estado: ${statusText}`, margin, y);
  
  // Si hay shootouts, mostrar resultado
  if (shootouts.length > 0) {
    y += 8;
    const team1ShootoutGoals = shootouts.filter(s => s.team === 'team1' && s.scored).length;
    const team2ShootoutGoals = shootouts.filter(s => s.team === 'team2' && s.scored).length;
    doc.setTextColor(255, 150, 0);
    doc.text(`Shootouts: ${team1ShootoutGoals} - ${team2ShootoutGoals}`, margin, y);
    doc.setTextColor(...textColor);
  }
  
  y += 15;
  
  // Separador
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  
  // GOLES
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`GOLES (${goals.length})`, margin, y);
  y += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  if (goals.length === 0) {
    doc.setTextColor(...grayColor);
    doc.text('Sin goles registrados', margin, y);
    y += lineHeight;
  } else {
    const team1Goals = goals.filter(g => g.team === 'team1');
    const team2Goals = goals.filter(g => g.team === 'team2');
    
    if (team1Goals.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${match.team1_name}:`, margin, y);
      y += lineHeight;
      doc.setFont('helvetica', 'normal');
      team1Goals.forEach(g => {
        const text = `  Q${g.quarter} ${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        doc.text(text, margin, y);
        y += lineHeight;
      });
    }
    
    if (team2Goals.length > 0) {
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.text(`${match.team2_name}:`, margin, y);
      y += lineHeight;
      doc.setFont('helvetica', 'normal');
      team2Goals.forEach(g => {
        const text = `  Q${g.quarter} ${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        doc.text(text, margin, y);
        y += lineHeight;
      });
    }
  }
  
  y += 5;
  
  // PARADAS
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`PARADAS (${saves.length})`, margin, y);
  y += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  if (saves.length === 0) {
    doc.setTextColor(...grayColor);
    doc.text('Sin paradas registradas', margin, y);
    y += lineHeight;
  } else {
    saves.forEach(s => {
      const text = `Q${s.quarter} ${s.match_minute}' - ${s.player_name || 'Portero'}${s.dorsal ? ` #${s.dorsal}` : ''}`;
      doc.text(text, margin, y);
      y += lineHeight;
    });
  }
  
  y += 5;
  
  // TARJETAS
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`TARJETAS (${cards.length})`, margin, y);
  y += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  if (cards.length === 0) {
    doc.setTextColor(...grayColor);
    doc.text('Sin tarjetas registradas', margin, y);
    y += lineHeight;
  } else {
    cards.forEach(c => {
      const cardEmoji = c.card_type === 'green' ? 'Verde' : c.card_type === 'yellow' ? 'Amarilla' : 'Roja';
      const text = `${cardEmoji} - Q${c.quarter} ${c.match_minute}' - ${c.player_name}${c.dorsal ? ` #${c.dorsal}` : ''} (${c.team === 'team1' ? match.team1_name : match.team2_name})`;
      doc.text(text, margin, y);
      y += lineHeight;
    });
  }
  
  y += 5;
  
  // PENALTY CORNER / STROKE
  const penaltyGoals = goals.filter(g => g.is_penalty);
  const penaltyMissesList = penaltyMisses.filter(pm => pm.type === 'penalty');
  const strokeMissesList = penaltyMisses.filter(pm => pm.type === 'stroke');
  const totalPenalties = penaltyGoals.length + penaltyMissesList.length;
  const totalStrokes = strokeMissesList.length;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`PENALTY CORNER / STROKE`, margin, y);
  y += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  // Penalty corners
  doc.text(`Penalty corners: ${penaltyGoals.length}/${totalPenalties} goles`, margin, y);
  y += lineHeight;
  
  if (penaltyMissesList.length > 0) {
    doc.text('Fallados:', margin, y);
    y += lineHeight;
    penaltyMissesList.forEach(pm => {
      const text = `  Q${pm.quarter} ${pm.match_minute}' - ${pm.team === 'team1' ? match.team1_name : match.team2_name}`;
      doc.text(text, margin, y);
      y += lineHeight;
    });
  }
  
  // Strokes
  if (strokeMissesList.length > 0) {
    doc.text(`Strokes fallados: ${strokeMissesList.length}`, margin, y);
    y += lineHeight;
    strokeMissesList.forEach(pm => {
      const text = `  Q${pm.quarter} ${pm.match_minute}' - ${pm.team === 'team1' ? match.team1_name : match.team2_name}`;
      doc.text(text, margin, y);
      y += lineHeight;
    });
  }
  
  if (totalPenalties === 0 && totalStrokes === 0) {
    doc.setTextColor(...grayColor);
    doc.text('Sin penalties/strokes registrados', margin, y);
    y += lineHeight;
  }
  
  // SHOOTOUTS - Nueva página si es necesario
  if (shootouts.length > 0) {
    // Verificar si necesitamos nueva página
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    
    y += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('SHOOTOUTS', margin, y);
    y += 8;
    
    const team1Goals = shootouts.filter(s => s.team === 'team1' && s.scored).length;
    const team2Goals = shootouts.filter(s => s.team === 'team2' && s.scored).length;
    
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(`${match.team1_name}: ${team1Goals}`, margin, y);
    doc.text(`${match.team2_name}: ${team2Goals}`, pageWidth / 2, y);
    y += 10;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    shootouts.forEach((s, idx) => {
      const result = s.scored ? '✓' : '✗';
      const teamName = s.team === 'team1' ? match.team1_name : match.team2_name;
      doc.text(`${idx + 1}. ${teamName} - ${s.player_name}${s.dorsal ? ` #${s.dorsal}` : ''} ${result}`, margin, y);
      y += lineHeight;
    });
  }
  
  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-ES')} - Página ${i} de ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }
  
  // Descargar
  const fileName = `${match.team1_name}_vs_${match.team2_name}_${new Date(match.created_at).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};