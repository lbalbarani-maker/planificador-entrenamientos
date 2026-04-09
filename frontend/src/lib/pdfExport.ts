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
  sanseRed: [220, 38, 38] as [number, number, number], // #dc2626
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

// Colores más claros para el segundo equipo (sin usar alpha)
const LIGHT_COLORS = {
  cardGreen: [150, 230, 170] as [number, number, number],
  cardYellow: [255, 230, 150] as [number, number, number],
  cardRed: [255, 150, 150] as [number, number, number],
};

// Logo del club Sanse (URL del bucket público)
const SANSE_LOGO_URL = 'https://rtyxufscynjpxuliwlpm.supabase.co/storage/v1/object/public/Public%20bucket/logos/1772731926231-k9pk0a.jpg';

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
  const { match, goals, saves, cards, penaltyMisses, shootouts, teamInfo, team1LogoUrl, team2LogoUrl } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;
  const margin = 15;
  
  // ============ PRECARGA DE LOGOS ============
  const logoCache: { [key: string]: string | null } = {
    club: null,
    team1: null,
    team2: null,
  };
  
  try {
    const clubImg = await loadImage(SANSE_LOGO_URL);
    logoCache.club = getBase64Image(clubImg);
  } catch (e) {
    console.log('No se pudo cargar logo del club');
  }
  
  if (team1LogoUrl) {
    try {
      const t1Img = await loadImage(team1LogoUrl);
      logoCache.team1 = getBase64Image(t1Img);
    } catch (e) {
      console.log('No se pudo cargar logo team1');
    }
  }
  
  if (team2LogoUrl) {
    try {
      const t2Img = await loadImage(team2LogoUrl);
      logoCache.team2 = getBase64Image(t2Img);
    } catch (e) {
      console.log('No se pudo cargar logo team2');
    }
  }
  
  // Fallback: si no hay logo de equipo, usar logo del club
  if (!logoCache.team1) logoCache.team1 = logoCache.club;
  if (!logoCache.team2) logoCache.team2 = logoCache.club;
  
  // Función para centrar texto
  const centerText = (text: string, yPos: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, yPos);
  };

  // Función para dibujar sección con título
  const drawSection = (title: string, yPos: number): number => {
    doc.setFillColor(...COLORS.sanseBlue);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 12, 3, 3, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, yPos + 8);
    return yPos + 16;
  };

  // Función para dibujar logo junto a texto
  const drawLogoWithText = (
    logoKey: 'team1' | 'team2' | 'club',
    text: string,
    x: number,
    yPos: number,
    fontSize: number = 10,
    isBold: boolean = false
  ): number => {
    const logoSize = 10;
    const logoMargin = 3;
    
    // Dibujar logo si existe
    if (logoCache[logoKey]) {
      doc.addImage(logoCache[logoKey]!, 'PNG', x, yPos - logoSize + 2, logoSize, logoSize);
    } else {
      // Fallback: círculo con iniciales
      doc.setFillColor(...COLORS.lightGray);
      doc.circle(x + logoSize/2, yPos - logoSize/2 + 2, logoSize/2, 'F');
      doc.setTextColor(...COLORS.white);
      doc.setFontSize(6);
      const initials = text.substring(0, 2).toUpperCase();
      doc.text(initials, x + 2, yPos - 1);
    }
    
    // Dibujar texto
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(text, x + logoSize + logoMargin, yPos);
    
    return x + logoSize + logoMargin + doc.getTextWidth(text);
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
    
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    
    for (let i = 0; i <= 4; i++) {
      const gridY = yPos + height - (i * height / 4);
      doc.line(chartX, gridY, chartX + chartWidth, gridY);
    }
    
    const stepX = chartWidth / (labels.length - 1);
    labels.forEach((_, i) => {
      const x = chartX + i * stepX;
      doc.line(x, yPos, x, yPos + height);
    });
    
    if (data1.some(v => v > 0)) {
      doc.setDrawColor(...colors[0]);
      doc.setLineWidth(2);
      
      for (let i = 0; i < data1.length - 1; i++) {
        const x1 = chartX + i * stepX;
        const y1 = yPos + height - (data1[i] / maxValue) * height;
        const x2 = chartX + (i + 1) * stepX;
        const y2 = yPos + height - (data1[i + 1] / maxValue) * height;
        doc.line(x1, y1, x2, y2);
      }
      
      data1.forEach((value, i) => {
        const x = chartX + i * stepX;
        const chartY = yPos + height - (value / maxValue) * height;
        doc.setFillColor(...colors[0]);
        doc.circle(x, chartY, 2, 'F');
      });
    }
    
    if (data2 && data2.some(v => v > 0)) {
      doc.setDrawColor(...colors[1]);
      doc.setLineWidth(2);
      
      for (let i = 0; i < data2.length - 1; i++) {
        const x1 = chartX + i * stepX;
        const y1 = yPos + height - (data2[i] / maxValue) * height;
        const x2 = chartX + (i + 1) * stepX;
        const y2 = yPos + height - (data2[i + 1] / maxValue) * height;
        doc.line(x1, y1, x2, y2);
      }
      
      data2.forEach((value, i) => {
        const x = chartX + i * stepX;
        const chartY = yPos + height - (value / maxValue) * height;
        doc.setFillColor(...colors[1]);
        doc.circle(x, chartY, 2, 'F');
      });
    }
    
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

  // Función para dibujar indicador circular
  const drawCircularIndicator = (
    success: number,
    failed: number,
    x: number,
    yPos: number,
    radius: number = 25
  ): void => {
    const total = success + failed;
    
    if (total === 0) {
      doc.setFillColor(...COLORS.lightGray);
      doc.circle(x, yPos, radius, 'F');
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(10);
      const text = 'Sin datos';
      const textWidth = doc.getTextWidth(text);
      doc.text(text, x - textWidth / 2, yPos + 3);
      return;
    }
    
    const successPercent = Math.round((success / total) * 100);
    
    if (successPercent >= 50) {
      doc.setFillColor(...COLORS.success);
    } else {
      doc.setFillColor(...COLORS.error);
    }
    doc.circle(x, yPos, radius, 'F');
    
    doc.setFillColor(...COLORS.white);
    doc.circle(x, yPos, radius * 0.7, 'F');
    
    if (successPercent >= 50) {
      doc.setFillColor(...COLORS.success);
    } else {
      doc.setFillColor(...COLORS.error);
    }
    doc.circle(x, yPos, radius * 0.5, 'F');
    
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const percentText = `${successPercent}%`;
    const textWidth = doc.getTextWidth(percentText);
    doc.text(percentText, x - textWidth / 2, yPos + 3);
    
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const legendText = `${success}/${total}`;
    const legendWidth = doc.getTextWidth(legendText);
    doc.text(legendText, x - legendWidth / 2, yPos + radius + 8);
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
    const barWidth = chartWidth / 8 - 2;
    const maxValue = Math.max(
      team1Data.green + team1Data.yellow + team1Data.red,
      team2Data.green + team2Data.yellow + team2Data.red,
      1
    );
    
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
    
    quarters.forEach((q, i) => {
      const xBase = chartX + i * (chartWidth / 4) + 5;
      
      let currentY = yPos + height;
      const t1 = team1ByQuarter[i];
      
      if (t1.g > 0) {
        const h = (t1.g / maxValue) * height;
        doc.setFillColor(...COLORS.cardGreen);
        doc.rect(xBase, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      if (t1.y > 0) {
        const h = (t1.y / maxValue) * height;
        doc.setFillColor(...COLORS.cardYellow);
        doc.rect(xBase, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      if (t1.r > 0) {
        const h = (t1.r / maxValue) * height;
        doc.setFillColor(...COLORS.cardRed);
        doc.rect(xBase, currentY - h, barWidth, h, 'F');
      }
      
      currentY = yPos + height;
      const t2 = team2ByQuarter[i];
      
      if (t2.g > 0) {
        const h = (t2.g / maxValue) * height;
        doc.setFillColor(...LIGHT_COLORS.cardGreen);
        doc.rect(xBase + barWidth + 2, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      if (t2.y > 0) {
        const h = (t2.y / maxValue) * height;
        doc.setFillColor(...LIGHT_COLORS.cardYellow);
        doc.rect(xBase + barWidth + 2, currentY - h, barWidth, h, 'F');
        currentY -= h;
      }
      if (t2.r > 0) {
        const h = (t2.r / maxValue) * height;
        doc.setFillColor(...LIGHT_COLORS.cardRed);
        doc.rect(xBase + barWidth + 2, currentY - h, barWidth, h, 'F');
      }
      
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(9);
      doc.text(q, xBase + barWidth - 2, yPos + height + 8);
    });
    
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(chartX, yPos + height, chartX + chartWidth, yPos + height);
    
    return yPos + height + 15;
  };

  // ============ HEADER CON FONDO ROJO ============
  
  // Fondo rojo Sanse
  doc.setFillColor(...COLORS.sanseRed);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo del club (centrado verticalmente en el header)
  try {
    if (logoCache.club) {
      doc.addImage(logoCache.club, 'PNG', margin, 5, 30, 30);
    }
  } catch (e) {
    // Si no carga, continuar sin logo
  }
  
  // Título principal (blanco sobre rojo)
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  centerText('RESUMEN DEL PARTIDO', 20, 22);
  
  // Subtítulo con categoría (sin duplicar género)
  if (teamInfo) {
    doc.setFontSize(12);
    // Usar solo el nombre que ya incluye la categoría completa
    centerText(teamInfo.name, 32, 12);
  }
  
  y = 50;
  
  // ============ INFO DEL PARTIDO ============
  
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const date = new Date(match.created_at);
  const dateStr = date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric'
  });
  doc.text(`Fecha: ${dateStr}`, margin, y);
  
  if (match.location) {
    doc.text(`Lugar: ${match.location}`, margin + 60, y);
  }
  
  y += 15;
  
  // ============ MARCADOR ============
  
  // Fondo del marcador
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 45, 5, 5, 'F');
  
  const centerX = pageWidth / 2;
  const logoSize = 25;
  const scoreY = y + 28;
  
  // Logo Team 1 (izquierda)
  if (logoCache.team1) {
    doc.addImage(logoCache.team1, 'PNG', margin + 10, y + 10, logoSize, logoSize);
  } else {
    doc.setFillColor(...COLORS.lightGray);
    doc.circle(margin + 10 + logoSize/2, y + 10 + logoSize/2, logoSize/2, 'F');
  }
  
  // Nombre Team 1 (debajo del logo)
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const team1Width = doc.getTextWidth(match.team1_name);
  doc.text(match.team1_name, margin + 10 + (logoSize - team1Width) / 2, y + 45);
  
  // Score Team 1
  doc.setFontSize(32);
  doc.text(match.score_team1.toString(), centerX - 45, scoreY);
  
  // VS
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(16);
  doc.text('VS', centerX - 6, scoreY - 2);
  
  // Score Team 2
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(32);
  doc.text(match.score_team2.toString(), centerX + 15, scoreY);
  
  // Logo Team 2 (derecha)
  if (logoCache.team2) {
    doc.addImage(logoCache.team2, 'PNG', pageWidth - margin - 10 - logoSize, y + 10, logoSize, logoSize);
  } else {
    doc.setFillColor(...COLORS.lightGray);
    doc.circle(pageWidth - margin - 10 - logoSize/2, y + 10 + logoSize/2, logoSize/2, 'F');
  }
  
  // Nombre Team 2 (debajo del logo)
  doc.setFontSize(11);
  const team2Width = doc.getTextWidth(match.team2_name);
  doc.text(match.team2_name, pageWidth - margin - 10 - logoSize + (logoSize - team2Width) / 2, y + 45);
  
  y += 55;
  
  // ============ GOLES ============
  if (goals.length > 0) {
    y = drawSection('GOLES', y);
    
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
    
    // Listado de goles con logos
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    
    const team1Goals = goals.filter(g => g.team === 'team1');
    const team2Goals = goals.filter(g => g.team === 'team2');
    
    if (team1Goals.length > 0) {
      drawLogoWithText('team1', match.team1_name, margin + 5, y, 10, true);
      y += 8;
      doc.setFont('helvetica', 'normal');
      team1Goals.forEach(g => {
        const text = `  Q${g.quarter} ${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        doc.text(text, margin + 5, y);
        y += 5;
      });
      y += 3;
    }
    
    if (team2Goals.length > 0) {
      drawLogoWithText('team2', match.team2_name, margin + 5, y, 10, true);
      y += 8;
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
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection('PARADAS', y);
    
    const savesByQuarter = [0, 0, 0, 0];
    saves.filter(s => s.team === 'team1').forEach(s => {
      if (s.quarter >= 1 && s.quarter <= 4) {
        savesByQuarter[s.quarter - 1]++;
      }
    });
    
    y = drawLineChart(savesByQuarter, null, ['Q1', 'Q2', 'Q3', 'Q4'], y, 50);
    
    // Listado de paradas con logo
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    
    drawLogoWithText('team1', match.team1_name, margin + 5, y, 10, true);
    y += 8;
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
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection('TARJETAS', y);
    
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
    
    // Listado con logos
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    
    cards.forEach(c => {
      const cardTypeText = c.card_type === 'green' ? 'Verde' : c.card_type === 'yellow' ? 'Amarilla' : 'Roja';
      const teamName = c.team === 'team1' ? match.team1_name : match.team2_name;
      const logoKey = c.team === 'team1' ? 'team1' : 'team2';
      
      drawLogoWithText(logoKey, `${cardTypeText} Q${c.quarter} ${c.match_minute}'`, margin + 5, y, 9);
      doc.text(`- ${c.player_name}${c.dorsal ? ` #${c.dorsal}` : ''} (${teamName})`, margin + 50, y);
      y += 6;
    });
    
    y += 10;
  }
  
  // ============ PENALTY CORNER ============
  const penaltyGoals = goals.filter(g => g.is_penalty);
  const penaltyMissList = penaltyMisses.filter(pm => pm.type === 'penalty');
  const totalPenalties = penaltyGoals.length + penaltyMissList.length;
  
  if (totalPenalties > 0) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection('PENALTY CORNER', y);
    
    const team1PenaltyGoals = penaltyGoals.filter(g => g.team === 'team1').length;
    const team1PenaltyMiss = penaltyMissList.filter(pm => pm.team === 'team1').length;
    const team2PenaltyGoals = penaltyGoals.filter(g => g.team === 'team2').length;
    const team2PenaltyMiss = penaltyMissList.filter(pm => pm.team === 'team2').length;
    
    const chartY = y + 30;
    
    // Team 1
    drawCircularIndicator(team1PenaltyGoals, team1PenaltyMiss, margin + 50, chartY, 25);
    drawLogoWithText('team1', match.team1_name, margin + 20, chartY + 40, 9, true);
    
    // Team 2
    drawCircularIndicator(team2PenaltyGoals, team2PenaltyMiss, pageWidth - margin - 50, chartY, 25);
    drawLogoWithText('team2', match.team2_name, pageWidth - margin - 80, chartY + 40, 9, true);
    
    y += 65;
    
    // Leyenda
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.success);
    doc.text('Convertidos', margin + 5, y);
    doc.setTextColor(...COLORS.error);
    doc.text('Fallados', margin + 40, y);
    
    y += 10;
  }
  
  // ============ STROKES ============
  const strokeMissList = penaltyMisses.filter(pm => pm.type === 'stroke');
  
  if (strokeMissList.length > 0) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection('STROKES', y);
    
    const team1Strokes = strokeMissList.filter(pm => pm.team === 'team1').length;
    const team2Strokes = strokeMissList.filter(pm => pm.team === 'team2').length;
    
    const chartY = y + 30;
    
    // Team 1
    drawCircularIndicator(0, team1Strokes, margin + 50, chartY, 25);
    drawLogoWithText('team1', match.team1_name, margin + 20, chartY + 40, 9, true);
    
    // Team 2
    drawCircularIndicator(0, team2Strokes, pageWidth - margin - 50, chartY, 25);
    drawLogoWithText('team2', match.team2_name, pageWidth - margin - 80, chartY + 40, 9, true);
    
    y += 65;
  }
  
  // ============ SHOOTOUTS ============
  if (shootouts.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }
    
    y = drawSection('SHOOTOUTS', y);
    
    const team1Goals = shootouts.filter(s => s.team === 'team1' && s.scored).length;
    const team2Goals = shootouts.filter(s => s.team === 'team2' && s.scored).length;
    
    // Marcador con logos
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    
    drawLogoWithText('team1', `${match.team1_name}: ${team1Goals}`, margin + 5, y, 12, true);
    drawLogoWithText('team2', `${match.team2_name}: ${team2Goals}`, pageWidth / 2, y, 12, true);
    
    y += 15;
    
    // Listado
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    shootouts.forEach((s, idx) => {
      const result = s.scored ? 'Gol' : 'Fallado';
      const logoKey = s.team === 'team1' ? 'team1' : 'team2';
      drawLogoWithText(logoKey, `${idx + 1}.`, margin + 5, y, 9);
      doc.text(`${s.player_name}${s.dorsal ? ` #${s.dorsal}` : ''} - ${result}`, margin + 25, y);
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
