import { jsPDF } from 'jspdf';
import { HockeyMatch, HockeyGoal, HockeySave, HockeyCard, HockeyPenaltyMiss, HockeyShootout } from '../types/hockey';

interface PDFData {
  match: HockeyMatch;
  goals: HockeyGoal[];
  saves: HockeySave[];
  cards: HockeyCard[];
  penaltyMisses: HockeyPenaltyMiss[];
  shootouts: HockeyShootout[];
  teamInfo?: {
    name: string;
    category: string;
    gender: string;
  };
  team1LogoUrl?: string;
  team2LogoUrl?: string;
  clubLogoUrl?: string;
}

// Colores del diseño
const COLORS = {
  sanseBlue: [30, 58, 138] as [number, number, number], // #1e3a8a
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
  success: [16, 185, 129] as [number, number, number], // #10b981
  error: [239, 68, 68] as [number, number, number], // #ef4444
  yellow: [245, 158, 11] as [number, number, number], // #f59e0b
  green: [34, 197, 94] as [number, number, number], // #22c55e
  cardRed: [220, 38, 38] as [number, number, number],
  cardYellow: [234, 179, 8] as [number, number, number],
  cardGreen: [34, 197, 94] as [number, number, number],
};

// Helper para cargar imagen desde URL
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

// Helper para convertir imagen a base64
const getBase64Image = (img: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  }
  return '';
};

export const generateMatchPDF = async (data: PDFData): Promise<void> => {
  const { match, goals, saves, cards, penaltyMisses, shootouts, teamInfo, team1LogoUrl, team2LogoUrl, clubLogoUrl } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;
  const margin = 15;
  
  // Función para centrar texto
  const centerText = (text: string, yPos: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, yPos);
  };

  // Función para dibujar sección con título
  const drawSection = (title: string, yPos: number): number => {
    // Fondo del título
    doc.setFillColor(...COLORS.sanseBlue);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 12, 3, 3, 'F');
    
    // Texto del título
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, yPos + 8);
    
    return yPos + 16;
  };

  // Función para dibujar gráfico de líneas
  const drawLineChart = (
    data1: number[],
    data2: number[] | null,
    labels: string[],
    yPos: number,
    height: number = 50,
    colors: [number, number, number][] = [COLORS.sanseBlue, COLORS.error]
  ): number => {
    const chartWidth = pageWidth - margin * 2 - 20;
    const chartX = margin + 10;
    const maxValue = Math.max(...data1, ...(data2 || []), 1);
    
    // Dibujar ejes
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    
    // Líneas horizontales de grid
    for (let i = 0; i <= 4; i++) {
      const gridY = yPos + height - (i * height / 4);
      doc.line(chartX, gridY, chartX + chartWidth, gridY);
    }
    
    // Líneas verticales
    const stepX = chartWidth / (labels.length - 1);
    labels.forEach((_, i) => {
      const x = chartX + i * stepX;
      doc.line(x, yPos, x, yPos + height);
    });
    
    // Dibujar línea de datos 1
    if (data1.some(v => v > 0)) {
      doc.setDrawColor(...colors[0]);
      doc.setLineWidth(2);
      let pathStarted = false;
      
      data1.forEach((value, i) => {
        const x = chartX + i * stepX;
        const chartY = yPos + height - (value / maxValue) * height;
        
        if (!pathStarted) {
          doc.moveTo(x, chartY);
          pathStarted = true;
        } else {
          doc.lineTo(x, chartY);
          doc.stroke();
          doc.moveTo(x, chartY);
        }
        
        // Punto
        doc.setFillColor(...colors[0]);
        doc.circle(x, chartY, 2, 'F');
      });
    }
    
    // Dibujar línea de datos 2
    if (data2 && data2.some(v => v > 0)) {
      doc.setDrawColor(...colors[1]);
      doc.setLineWidth(2);
      let pathStarted = false;
      
      data2.forEach((value, i) => {
        const x = chartX + i * stepX;
        const chartY = yPos + height - (value / maxValue) * height;
        
        if (!pathStarted) {
          doc.moveTo(x, chartY);
          pathStarted = true;
        } else {
          doc.lineTo(x, chartY);
          doc.stroke();
          doc.moveTo(x, chartY);
        }
        
        // Punto
        doc.setFillColor(...colors[1]);
        doc.circle(x, chartY, 2, 'F');
      });
    }
    
    // Labels del eje X
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    labels.forEach((label, i) => {
      const x = chartX + i * stepX;
      const textWidth = doc.getTextWidth(label);
      doc.text(label, x - textWidth / 2, yPos + height + 8);
    });
    
    return yPos + height + 15;
  };

  // Función para dibujar gráfico circular (torta)
  const drawPieChart = (
    success: number,
    failed: number,
    x: number,
    yPos: number,
    radius: number = 25
  ): void => {
    const total = success + failed;
    
    if (total === 0) {
      // Círculo gris vacío
      doc.setFillColor(...COLORS.lightGray);
      doc.circle(x, yPos, radius, 'F');
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(10);
      centerText('Sin datos', yPos + 3);
      return;
    }
    
    const successAngle = (success / total) * 2 * Math.PI;
    
    // Dibujar sector de éxito
    doc.setFillColor(...COLORS.success);
    doc.moveTo(x, yPos);
    doc.arc(x, yPos, radius, 0, successAngle);
    doc.closePath();
    doc.fill();
    
    // Dibujar sector de fallo
    doc.setFillColor(...COLORS.error);
    doc.moveTo(x, yPos);
    doc.arc(x, yPos, radius, successAngle, 2 * Math.PI);
    doc.closePath();
    doc.fill();
    
    // Centro blanco para efecto donut
    doc.setFillColor(...COLORS.white);
    doc.circle(x, yPos, radius * 0.5, 'F');
    
    // Texto central
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const percentText = `${Math.round((success / total) * 100)}%`;
    const textWidth = doc.getTextWidth(percentText);
    doc.text(percentText, x - textWidth / 2, yPos + 2);
  };

  // Función para dibujar gráfico de barras para tarjetas
  const drawCardBarChart = (
    team1Data: { green: number; yellow: number; red: number },
    team2Data: { green: number; yellow: number; red: number },
    yPos: number,
    height: number = 40
  ): number => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const chartWidth = pageWidth - margin * 2 - 20;
    const chartX = margin + 10;
    const barWidth = chartWidth / 8 - 2; // 2 barras por cuarto
    const maxValue = Math.max(
      team1Data.green + team1Data.yellow + team1Data.red,
      team2Data.green + team2Data.yellow + team2Data.red,
      1
    );
    
    // Agrupar tarjetas por cuarto
    const team1ByQuarter = [{g:0,y:0,r:0}, {g:0,y:0,r:0}, {g:0,y:0,r:0}, {g:0,y:0,r:0}];
    const team2ByQuarter = [{g:0,y:0,r:0}, {g:0,y:0,r:0}, {g:0,y:0,r:0}, {g:0,y:0,r:0}];
    
    cards.filter(c => c.team === 'team1').forEach(c => {
      if (c.quarter >= 1 && c.quarter <= 4) {
        if (c.card_type === 'green') team1ByQuarter[c.quarter-1].g++;
        if (c.card_type === 'yellow') team1ByQuarter[c.quarter-1].y++;
        if (c.card_type === 'red') team1ByQuarter[c.quarter-1].r++;
      }
    });
    
    cards.filter(c => c.team === 'team2').forEach(c => {
      if (c.quarter >= 1 && c.quarter <= 4) {
        if (c.card_type === 'green') team2ByQuarter[c.quarter-1].g++;
        if (c.card_type === 'yellow') team2ByQuarter[c.quarter-1].y++;
        if (c.card_type === 'red') team2ByQuarter[c.quarter-1].r++;
      }
    });
    
    // Dibujar barras
    quarters.forEach((q, i) => {
      const xBase = chartX + i * (chartWidth / 4) + 5;
      
      // Team 1
      let currentY = yPos + height;
      const t1 = team1ByQuarter[i];
      
      // Verde
      if (t1.g > 0) {
        const h = (t1.g / maxValue) * height;
        doc.setFillColor(...COLORS.cardGreen);
        doc.rect(xBase, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      // Amarilla
      if (t1.y > 0) {
        const h = (t1.y / maxValue) * height;
        doc.setFillColor(...COLORS.cardYellow);
        doc.rect(xBase, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      // Roja
      if (t1.r > 0) {
        const h = (t1.r / maxValue) * height;
        doc.setFillColor(...COLORS.cardRed);
        doc.rect(xBase, currentY - h, barWidth, h, 'F');
      }
      
      // Team 2
      currentY = yPos + height;
      const t2 = team2ByQuarter[i];
      
      // Verde
      if (t2.g > 0) {
        const h = (t2.g / maxValue) * height;
        doc.setFillColor(...COLORS.cardGreen);
        doc.setGlobalAlpha(0.5);
        doc.rect(xBase + barWidth + 2, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      // Amarilla
      if (t2.y > 0) {
        const h = (t2.y / maxValue) * height;
        doc.setFillColor(...COLORS.cardYellow);
        doc.setGlobalAlpha(0.5);
        doc.rect(xBase + barWidth + 2, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      // Roja
      if (t2.r > 0) {
        const h = (t2.r / maxValue) * height;
        doc.setFillColor(...COLORS.cardRed);
        doc.setGlobalAlpha(0.5);
        doc.rect(xBase + barWidth + 2, currentY - h, barWidth, h, 'F');
      }
      doc.setGlobalAlpha(1);
      
      // Label
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(9);
      doc.text(q, xBase + barWidth - 2, yPos + height + 8);
    });
    
    // Línea base
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(chartX, yPos + height, chartX + chartWidth, yPos + height);
    
    return yPos + height + 15;
  };

  // ============ HEADER ============
  
  // Logo del club
  try {
    const logoUrl = clubLogoUrl || '/images/logosanse.png';
    const logoImg = await loadImage(logoUrl);
    const logoData = getBase64Image(logoImg);
    if (logoData) {
      doc.addImage(logoData, 'PNG', margin, 10, 30, 30);
    }
  } catch (e) {
    // Si no carga el logo, continuar sin él
  }
  
  // Título principal
  doc.setTextColor(...COLORS.sanseBlue);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  centerText('RESUMEN DEL PARTIDO', 25, 24);
  
  // Subtítulo con categoría
  if (teamInfo) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(14);
    const genderText = teamInfo.gender === 'fem' ? 'Femenina' : teamInfo.gender === 'masc' ? 'Masculina' : '';
    const categoryText = `${teamInfo.name} ${genderText}`.trim();
    centerText(categoryText, 35, 14);
  }
  
  y = 50;
  
  // ============ INFO DEL PARTIDO ============
  
  // Fecha con icono de calendario (usando emoji)
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const date = new Date(match.created_at);
  const dateStr = date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric'
  });
  doc.text(`📅 ${dateStr}`, margin, y);
  
  // Ubicación
  if (match.location) {
    doc.text(`📍 ${match.location}`, margin + 60, y);
  }
  
  y += 15;
  
  // ============ MARCADOR ============
  
  // Fondo del marcador
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 45, 5, 5, 'F');
  
  // Logos y nombres de equipos
  const centerX = pageWidth / 2;
  
  // Team 1 (izquierda)
  try {
    if (team1LogoUrl) {
      const logo1Img = await loadImage(team1LogoUrl);
      const logo1Data = getBase64Image(logo1Img);
      if (logo1Data) {
        doc.addImage(logo1Data, 'PNG', margin + 10, y + 5, 25, 25);
      }
    }
  } catch (e) {
    // Fallback: iniciales
    doc.setFillColor(...COLORS.lightGray);
    doc.circle(margin + 22, y + 17, 12, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const initials = match.team1_name.substring(0, 2).toUpperCase();
    doc.text(initials, margin + 18, y + 20);
  }
  
  // Nombre team 1
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const team1Name = match.team1_name;
  const team1Width = doc.getTextWidth(team1Name);
  doc.text(team1Name, centerX - 50 - team1Width, y + 20);
  
  // Score team 1
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(match.score_team1.toString(), centerX - 35, y + 25);
  
  // VS
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(14);
  doc.text('VS', centerX - 5, y + 22);
  
  // Score team 2
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(28);
  doc.text(match.score_team2.toString(), centerX + 10, y + 25);
  
  // Nombre team 2
  doc.setFontSize(12);
  doc.text(match.team2_name, centerX + 30, y + 20);
  
  // Team 2 logo (derecha)
  try {
    if (team2LogoUrl) {
      const logo2Img = await loadImage(team2LogoUrl);
      const logo2Data = getBase64Image(logo2Img);
      if (logo2Data) {
        doc.addImage(logo2Data, 'PNG', pageWidth - margin - 35, y + 5, 25, 25);
      }
    }
  } catch (e) {
    // Fallback: iniciales
    doc.setFillColor(...COLORS.lightGray);
    doc.circle(pageWidth - margin - 22, y + 17, 12, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(10);
    const initials = match.team2_name.substring(0, 2).toUpperCase();
    doc.text(initials, pageWidth - margin - 26, y + 20);
  }
  
  y += 55;
  
  // ============ GOLES ============
  if (goals.length > 0) {
    y = drawSection(`⚽ GOLES (${goals.length})`, y);
    
    // Gráfico de líneas
    const team1GoalsByQuarter = [0, 0, 0, 0];
    const team2GoalsByQuarter = [0, 0, 0, 0];
    
    goals.forEach(g => {
      if (g.quarter >= 1 && g.quarter <= 4) {
        if (g.team === 'team1') team1GoalsByQuarter[g.quarter - 1]++;
        else team2GoalsByQuarter[g.quarter - 1]++;
      }
    });
    
    y = drawLineChart(team1GoalsByQuarter, team2GoalsByQuarter, ['Q1', 'Q2', 'Q3', 'Q4'], y, 50, 
      [match.team1_color ? hexToRgb(match.team1_color) || COLORS.sanseBlue : COLORS.sanseBlue, 
       match.team2_color ? hexToRgb(match.team2_color) || COLORS.error : COLORS.error]);
    
    // Listado de goles
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    
    const team1Goals = goals.filter(g => g.team === 'team1');
    const team2Goals = goals.filter(g => g.team === 'team2');
    
    if (team1Goals.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${match.team1_name}:`, margin + 5, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      team1Goals.forEach(g => {
        const text = `  Q${g.quarter} ${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        doc.text(text, margin + 5, y);
        y += 5;
      });
      y += 3;
    }
    
    if (team2Goals.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${match.team2_name}:`, margin + 5, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      team2Goals.forEach(g => {
        const text = `  Q${g.quarter} ${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        doc.text(text, margin + 5, y);
        y += 5;
      });
    }
    
    y += 10;
  }
  
  // ============ PARADAS ============
  if (saves.length > 0) {
    // Nueva página si es necesario
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection(`🧤 PARADAS (${saves.length})`, y);
    
    // Gráfico de líneas solo para team 1
    const savesByQuarter = [0, 0, 0, 0];
    saves.filter(s => s.team === 'team1').forEach(s => {
      if (s.quarter >= 1 && s.quarter <= 4) {
        savesByQuarter[s.quarter - 1]++;
      }
    });
    
    y = drawLineChart(savesByQuarter, null, ['Q1', 'Q2', 'Q3', 'Q4'], y, 50);
    
    // Listado de paradas
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    saves.forEach(s => {
      const text = `Q${s.quarter} ${s.match_minute}' - ${s.player_name || 'Portera'}${s.dorsal ? ` #${s.dorsal}` : ''}`;
      doc.text(text, margin + 5, y);
      y += 5;
    });
    
    y += 10;
  }
  
  // ============ TARJETAS ============
  if (cards.length > 0) {
    // Nueva página si es necesario
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection(`🟨 TARJETAS (${cards.length})`, y);
    
    // Gráfico de barras
    const team1Cards = { green: 0, yellow: 0, red: 0 };
    const team2Cards = { green: 0, yellow: 0, red: 0 };
    
    cards.forEach(c => {
      if (c.team === 'team1') {
        if (c.card_type === 'green') team1Cards.green++;
        if (c.card_type === 'yellow') team1Cards.yellow++;
        if (c.card_type === 'red') team1Cards.red++;
      } else {
        if (c.card_type === 'green') team2Cards.green++;
        if (c.card_type === 'yellow') team2Cards.yellow++;
        if (c.card_type === 'red') team2Cards.red++;
      }
    });
    
    y = drawCardBarChart(team1Cards, team2Cards, y);
    
    // Listado
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    
    cards.forEach(c => {
      const cardEmoji = c.card_type === 'green' ? '🟢' : c.card_type === 'yellow' ? '🟡' : '🔴';
      const teamName = c.team === 'team1' ? match.team1_name : match.team2_name;
      const text = `${cardEmoji} Q${c.quarter} ${c.match_minute}' - ${c.player_name}${c.dorsal ? ` #${c.dorsal}` : ''} (${teamName})`;
      doc.text(text, margin + 5, y);
      y += 5;
    });
    
    y += 10;
  }
  
  // ============ PENALTY CORNER ============
  const penaltyGoals = goals.filter(g => g.is_penalty);
  const penaltyMissList = penaltyMisses.filter(pm => pm.type === 'penalty');
  const totalPenalties = penaltyGoals.length + penaltyMissList.length;
  
  if (totalPenalties > 0) {
    // Nueva página si es necesario
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection(`🎯 PENALTY CORNER (${totalPenalties})`, y);
    
    // Gráficos circulares
    const team1PenaltyGoals = penaltyGoals.filter(g => g.team === 'team1').length;
    const team1PenaltyMiss = penaltyMissList.filter(pm => pm.team === 'team1').length;
    const team2PenaltyGoals = penaltyGoals.filter(g => g.team === 'team2').length;
    const team2PenaltyMiss = penaltyMissList.filter(pm => pm.team === 'team2').length;
    
    const chartY = y + 30;
    
    // Team 1
    drawPieChart(team1PenaltyGoals, team1PenaltyMiss, margin + 50, chartY, 25);
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(match.team1_name, margin + 35, chartY + 35);
    
    // Team 2
    drawPieChart(team2PenaltyGoals, team2PenaltyMiss, pageWidth - margin - 50, chartY, 25);
    doc.text(match.team2_name, pageWidth - margin - 65, chartY + 35);
    
    y += 75;
    
    // Leyenda
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.success);
    doc.text('● Convertidos', margin + 5, y);
    doc.setTextColor(...COLORS.error);
    doc.text('● Fallados', margin + 40, y);
    
    y += 10;
  }
  
  // ============ STROKES ============
  const strokeMissList = penaltyMisses.filter(pm => pm.type === 'stroke');
  
  if (strokeMissList.length > 0) {
    // Nueva página si es necesario
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection(`🎯 STROKES (${strokeMissList.length})`, y);
    
    // Gráficos circulares
    const team1Strokes = strokeMissList.filter(pm => pm.team === 'team1').length;
    const team2Strokes = strokeMissList.filter(pm => pm.team === 'team2').length;
    
    const chartY = y + 30;
    
    // Team 1
    drawPieChart(0, team1Strokes, margin + 50, chartY, 25);
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(match.team1_name, margin + 35, chartY + 35);
    
    // Team 2
    drawPieChart(0, team2Strokes, pageWidth - margin - 50, chartY, 25);
    doc.text(match.team2_name, pageWidth - margin - 65, chartY + 35);
    
    y += 75;
  }
  
  // ============ SHOOTOUTS ============
  if (shootouts.length > 0) {
    // Nueva página si es necesario
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection(`🎯 SHOOTOUTS (${shootouts.length})`, y);
    
    const team1Goals = shootouts.filter(s => s.team === 'team1' && s.scored).length;
    const team2Goals = shootouts.filter(s => s.team === 'team2' && s.scored).length;
    
    // Marcador de shootouts
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text(`${match.team1_name}: ${team1Goals}`, margin + 5, y);
    doc.text(`${match.team2_name}: ${team2Goals}`, pageWidth / 2, y);
    
    y += 10;
    
    // Listado
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    shootouts.forEach((s, idx) => {
      const result = s.scored ? '✓' : '✗';
      const teamName = s.team === 'team1' ? match.team1_name : match.team2_name;
      doc.text(`${idx + 1}. ${teamName} - ${s.player_name}${s.dorsal ? ` #${s.dorsal}` : ''} ${result}`, margin + 5, y);
      y += 5;
    });
  }
  
  // ============ DESCARGAR ============
  const fileName = `${match.team1_name}_vs_${match.team2_name}_${new Date(match.created_at).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

// Helper para convertir hex a RGB
function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}
