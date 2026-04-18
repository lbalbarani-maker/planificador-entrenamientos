import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
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
  eventDate?: string;
  eventLocation?: string;
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
  q1: [59, 130, 246] as [number, number, number], // Azul
  q2: [34, 197, 94] as [number, number, number], // Verde  
  q3: [245, 158, 11] as [number, number, number], // Naranja
  q4: [220, 38, 38] as [number, number, number], // Rojo
};

// Colores más claros para el segundo equipo
const LIGHT_COLORS = {
  cardGreen: [150, 230, 170] as [number, number, number],
  cardYellow: [255, 230, 150] as [number, number, number],
  cardRed: [255, 150, 150] as [number, number, number],
};

// Logo del club Sanse
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

// Helper para convertir imagen a base64 circular
const getCircularImage = (img: HTMLImageElement, size: number = 100): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Crear máscara circular
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    
    // Dibujar imagen
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  }
  return '';
};

export const generateMatchPDF = async (data: PDFData): Promise<void> => {
  const { match, goals, saves, cards, penaltyMisses, shootouts, teamInfo, team1LogoUrl, team2LogoUrl, eventDate, eventLocation } = data;
  
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
  
  // Usar logo del parámetro, o del match, o null
  const effectiveTeam1Logo = team1LogoUrl || match.team1_logo_url || null;
  const effectiveTeam2Logo = team2LogoUrl || match.team2_logo_url || null;
  
  // DEBUG: Verificar URLs de logos
  console.log('=== PDF EXPORT DEBUG ===');
  console.log('team1LogoUrl (parámetro):', team1LogoUrl);
  console.log('match.team1_logo_url:', match.team1_logo_url);
  console.log('effectiveTeam1Logo:', effectiveTeam1Logo);
  console.log('team2LogoUrl (parámetro):', team2LogoUrl);
  console.log('match.team2_logo_url:', match.team2_logo_url);
  console.log('effectiveTeam2Logo:', effectiveTeam2Logo);
  console.log('¿Son iguales?:', effectiveTeam1Logo === effectiveTeam2Logo);
  
  try {
    const clubImg = await loadImage(SANSE_LOGO_URL);
    logoCache.club = getCircularImage(clubImg, 100);
    console.log('Logo club cargado OK');
  } catch (e) {
    console.log('No se pudo cargar logo del club');
  }
  
  if (effectiveTeam1Logo) {
    try {
      const t1Img = await loadImage(effectiveTeam1Logo);
      logoCache.team1 = getCircularImage(t1Img, 100);
      console.log('Logo team1 cargado OK desde:', effectiveTeam1Logo);
    } catch (e) {
      console.log('No se pudo cargar logo team1:', e);
    }
  } else {
    console.log('team1 logo es null/undefined');
  }
  
  if (effectiveTeam2Logo) {
    try {
      const t2Img = await loadImage(effectiveTeam2Logo);
      logoCache.team2 = getCircularImage(t2Img, 100);
      console.log('Logo team2 cargado OK desde:', effectiveTeam2Logo);
    } catch (e) {
      console.log('No se pudo cargar logo team2:', e);
    }
  } else {
    console.log('team2 logo es null/undefined');
  }
  
  // DEBUG: Estado antes de fallback
  console.log('Estado logoCache antes de fallback:', {
    team1: logoCache.team1 ? 'Cargado' : 'No cargado',
    team2: logoCache.team2 ? 'Cargado' : 'No cargado',
    club: logoCache.club ? 'Cargado' : 'No cargado'
  });
  
  // Si no hay logos cargados, intentar obtener desde tabla clubs (evita CORS)
  if (!logoCache.team1 || !logoCache.team2) {
    try {
      console.log('Intentando obtener logos desde tabla clubs...');
      const { data: clubs } = await supabase
        .from('clubs')
        .select('name, logo_url')
        .in('name', [match.team1_name, match.team2_name]);
      
      if (clubs) {
        console.log('Clubs encontrados:', clubs.map(c => c.name));
        
        for (const club of clubs) {
          if (club.logo_url) {
            try {
              const clubImg = await loadImage(club.logo_url);
              const circularImg = getCircularImage(clubImg, 100);
              
              if (club.name === match.team1_name && !logoCache.team1) {
                logoCache.team1 = circularImg;
                console.log('Logo team1 cargado desde clubs:', club.name);
              } else if (club.name === match.team2_name && !logoCache.team2) {
                logoCache.team2 = circularImg;
                console.log('Logo team2 cargado desde clubs:', club.name);
              }
            } catch (e) {
              console.log('Error cargando logo desde clubs:', club.name, e);
            }
          }
        }
      }
    } catch (e) {
      console.log('Error consultando tabla clubs:', e);
    }
  }
  
  // Fallback final: si no hay logo de equipo, usar logo del club
  if (!logoCache.team1) logoCache.team1 = logoCache.club;
  if (!logoCache.team2) logoCache.team2 = logoCache.club;
  
  // DEBUG: Estado después de fallback
  console.log('Estado logoCache después de fallback:', {
    team1: logoCache.team1 ? 'Cargado' : 'No cargado',
    team2: logoCache.team2 ? 'Cargado' : 'No cargado',
    club: logoCache.club ? 'Cargado' : 'No cargado'
  });
  console.log('=== FIN DEBUG ===');
  
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

  // Función para dibujar logo circular
  const drawCircularLogo = (logoKey: 'team1' | 'team2' | 'club', x: number, yPos: number, size: number) => {
    if (logoCache[logoKey]) {
      doc.addImage(logoCache[logoKey]!, 'PNG', x, yPos, size, size);
    } else {
      // Fallback: círculo gris
      doc.setFillColor(...COLORS.lightGray);
      doc.circle(x + size/2, yPos + size/2, size/2, 'F');
    }
  };

  // Función para dibujar gráfico de líneas con valores en eje Y
  const drawLineChart = (
    data1: number[],
    data2: number[] | null,
    labels: string[],
    yPos: number,
    height: number = 50,
    colors: [number, number, number][] = [COLORS.sanseBlue, COLORS.error]
  ): number => {
    const chartWidth = pageWidth - margin * 2 - 35;
    const chartX = margin + 25;
    const maxValue = Math.max(...data1, ...(data2 || []), 1);
    
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    
    // Líneas horizontales de grid y valores en eje Y
    for (let i = 0; i <= maxValue; i++) {
      const gridY = yPos + height - (i / maxValue) * height;
      doc.line(chartX, gridY, chartX + chartWidth, gridY);
      
      // Mostrar valor en eje Y
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(8);
      doc.text(i.toString(), margin + 2, gridY + 2);
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

  // Función para dibujar gráfico de barras horizontal
  const drawHorizontalBarChart = (
    team1Success: number,
    team1Failed: number,
    team2Success: number,
    team2Failed: number,
    yPos: number
  ): number => {
    const barHeight = 20;
    const maxWidth = (pageWidth - margin * 2 - 40) / 2;
    const maxValue = Math.max(team1Success + team1Failed, team2Success + team2Failed, 1);
    
    const col1X = margin + 20;
    const col2X = pageWidth / 2 + 20;
    
    // Team 1
    const t1Total = team1Success + team1Failed;
    const t1Width = (t1Total / maxValue) * maxWidth;
    const t1SuccessWidth = team1Success > 0 ? (team1Success / maxValue) * maxWidth : 0;
    
    // Fondo gris con bordes redondeados
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(col1X, yPos, maxWidth, barHeight, 3, 3, 'F');
    
    // Barra de éxito (verde) - SIN BORDES REDONDEADOS
    if (t1SuccessWidth > 0) {
      doc.setFillColor(...COLORS.success);
      doc.rect(col1X, yPos, t1SuccessWidth, barHeight, 'F');
    }
    
    // Barra de fallo (rojo) - SIN BORDES REDONDEADOS
    if (team1Failed > 0 && t1SuccessWidth < t1Width) {
      doc.setFillColor(...COLORS.error);
      doc.rect(col1X + t1SuccessWidth, yPos, t1Width - t1SuccessWidth, barHeight, 'F');
    }
    
    // Texto Team 1
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${team1Success}/${t1Total}`, col1X + 5, yPos + 14);
    
    // Team 2
    const t2Total = team2Success + team2Failed;
    const t2Width = (t2Total / maxValue) * maxWidth;
    const t2SuccessWidth = team2Success > 0 ? (team2Success / maxValue) * maxWidth : 0;
    
    // Fondo gris con bordes redondeados
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(col2X, yPos, maxWidth, barHeight, 3, 3, 'F');
    
    // Barra de éxito (verde) - SIN BORDES REDONDEADOS
    if (t2SuccessWidth > 0) {
      doc.setFillColor(...COLORS.success);
      doc.rect(col2X, yPos, t2SuccessWidth, barHeight, 'F');
    }
    
    // Barra de fallo (rojo) - SIN BORDES REDONDEADOS
    if (team2Failed > 0 && t2SuccessWidth < t2Width) {
      doc.setFillColor(...COLORS.error);
      doc.rect(col2X + t2SuccessWidth, yPos, t2Width - t2SuccessWidth, barHeight, 'F');
    }
    
    // Texto Team 2
    doc.text(`${team2Success}/${t2Total}`, col2X + 5, yPos + 14);
    
    return yPos + barHeight + 10;
  };

  // Función para dibujar tag de tarjeta
  const drawCardTag = (cardType: 'green' | 'yellow' | 'red', x: number, yPos: number): number => {
    const tagWidth = 20;
    const tagHeight = 10;
    
    let bgColor: [number, number, number];
    let textColor: [number, number, number];
    let text: string;
    
    if (cardType === 'green') {
      bgColor = COLORS.cardGreen;
      textColor = COLORS.white;
      text = 'V';
    } else if (cardType === 'yellow') {
      bgColor = COLORS.cardYellow;
      textColor = COLORS.black;
      text = 'A';
    } else {
      bgColor = COLORS.cardRed;
      textColor = COLORS.white;
      text = 'R';
    }
    
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, yPos - 8, tagWidth, tagHeight, 2, 2, 'F');
    doc.setTextColor(...textColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const textWidth = doc.getTextWidth(text);
    doc.text(text, x + (tagWidth - textWidth) / 2, yPos - 1);
    
    return x + tagWidth + 3;
  };

  // Función para dibujar tag de quarter
  const drawQuarterTag = (quarter: number, x: number, yPos: number): number => {
    const tagWidth = 16;
    const tagHeight = 10;
    
    const qColors: { [key: number]: [number, number, number] } = {
      1: COLORS.q1,
      2: COLORS.q2,
      3: COLORS.q3,
      4: COLORS.q4,
    };
    
    doc.setFillColor(...qColors[quarter]);
    doc.roundedRect(x, yPos - 8, tagWidth, tagHeight, 2, 2, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const text = `Q${quarter}`;
    const textWidth = doc.getTextWidth(text);
    doc.text(text, x + (tagWidth - textWidth) / 2, yPos - 1);
    
    return x + tagWidth + 3;
  };

  // ============ HEADER CON FONDO ROJO ============
  
  doc.setFillColor(...COLORS.sanseRed);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo del club circular
  if (logoCache.club) {
    doc.addImage(logoCache.club, 'PNG', margin, 5, 30, 30);
  }
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  centerText('RESUMEN DEL PARTIDO', 20, 22);
  
  if (teamInfo) {
    doc.setFontSize(12);
    centerText(teamInfo.name, 32, 12);
  }
  
  y = 50;
  
  // ============ INFO DEL PARTIDO ============
  
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Fecha del evento
  const dateStr = eventDate 
    ? new Date(eventDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date(match.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Fecha: ${dateStr}`, margin, y);
  y += 7;
  
  // Ubicación del evento (no del match)
  const locationStr = eventLocation || match.location;
  if (locationStr) {
    doc.text(`Lugar: ${locationStr}`, margin, y);
    y += 8;
  } else {
    y += 8;
  }
  
  // ============ MARCADOR CENTRADO ============
  
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 50, 5, 5, 'F');
  
  const colWidth = (pageWidth - margin * 2) / 3;
  const logoSize = 22;
  
  // Columna 1: Logo + Nombre Team 1
  const col1Center = margin + colWidth / 2;
  drawCircularLogo('team1', col1Center - logoSize/2, y + 8, logoSize);
  
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const team1Width = doc.getTextWidth(match.team1_name);
  doc.text(match.team1_name, col1Center - team1Width / 2, y + 38);
  
  // Columna 2: Scores + VS - CENTRADOS EN EL MISMO EJE Y
  const col2Center = margin + colWidth + colWidth / 2;
  const scoreY = y + 30;
  
  // Score 1
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  const score1Width = doc.getTextWidth(match.score_team1.toString());
  doc.text(match.score_team1.toString(), col2Center - 20 - score1Width / 2, scoreY);
  
  // VS
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(14);
  const vsWidth = doc.getTextWidth('VS');
  doc.text('VS', col2Center - vsWidth / 2, scoreY - 2);
  
  // Score 2
  doc.setTextColor(...COLORS.black);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  const score2Width = doc.getTextWidth(match.score_team2.toString());
  doc.text(match.score_team2.toString(), col2Center + 20 - score2Width / 2, scoreY);
  
  // Columna 3: Logo + Nombre Team 2
  const col3Center = margin + colWidth * 2 + colWidth / 2;
  drawCircularLogo('team2', col3Center - logoSize/2, y + 8, logoSize);
  
  doc.setFontSize(10);
  const team2Width = doc.getTextWidth(match.team2_name);
  doc.text(match.team2_name, col3Center - team2Width / 2, y + 38);
  
  y += 60;
  
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
    
    y += 10;
    
    // Listado de goles en 2 columnas
    const team1Goals = goals.filter(g => g.team === 'team1');
    const team2Goals = goals.filter(g => g.team === 'team2');
    
    const col1X = margin + 5;
    const col2X = pageWidth / 2 + 5;
    const startY = y;
    
    // Columna Team 1
    if (team1Goals.length > 0) {
      drawCircularLogo('team1', col1X, y, 12);
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(match.team1_name, col1X + 15, y + 8);
      y += 18;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      team1Goals.forEach(g => {
        let x = col1X;
        x = drawQuarterTag(g.quarter, x, y);
        let text = `${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        if (g.is_penalty) text += ' (PC)';
        doc.setTextColor(...COLORS.black);
        doc.text(text, x, y);
        y += 12;
      });
    }
    
    // Columna Team 2
    let y2 = startY;
    if (team2Goals.length > 0) {
      drawCircularLogo('team2', col2X, y2, 12);
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(match.team2_name, col2X + 15, y2 + 8);
      y2 += 18;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      team2Goals.forEach(g => {
        let x = col2X;
        x = drawQuarterTag(g.quarter, x, y2);
        let text = `${g.match_minute}' - ${g.player_name}${g.dorsal ? ` #${g.dorsal}` : ''}`;
        if (g.is_penalty) text += ' (PC)';
        doc.setTextColor(...COLORS.black);
        doc.text(text, x, y2);
        y2 += 12;
      });
    }
    
    y = Math.max(y, y2) + 10;
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
    
    y += 15;
    
    // Logo y listado
    drawCircularLogo('team1', margin + 5, y, 12);
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(match.team1_name, margin + 20, y + 8);
    y += 18;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    saves.forEach(s => {
      let x = margin + 5;
      x = drawQuarterTag(s.quarter, x, y);
      const text = `${s.match_minute}' - ${s.player_name || 'Portera'}${s.dorsal ? ` #${s.dorsal}` : ''}`;
      doc.setTextColor(...COLORS.black);
      doc.text(text, x, y);
      y += 12;
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
    
    const team1Cards = cards.filter(c => c.team === 'team1');
    const team2Cards = cards.filter(c => c.team === 'team2');
    
    const col1X = margin + 5;
    const col2X = pageWidth / 2 + 5;
    const startY = y;
    
    // Columna Team 1
    if (team1Cards.length > 0) {
      drawCircularLogo('team1', col1X, y, 12);
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(match.team1_name, col1X + 15, y + 8);
      y += 20;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      team1Cards.forEach(c => {
        let x = col1X;
        x = drawCardTag(c.card_type, x, y);
        x = drawQuarterTag(c.quarter, x, y);
        doc.setTextColor(...COLORS.black);
        doc.text(`${c.match_minute}' - ${c.player_name}${c.dorsal ? ` #${c.dorsal}` : ''}`, x, y);
        y += 12;
      });
    }
    
    // Columna Team 2
    let y2 = startY;
    if (team2Cards.length > 0) {
      drawCircularLogo('team2', col2X, y2, 12);
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(match.team2_name, col2X + 15, y2 + 8);
      y2 += 20;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      team2Cards.forEach(c => {
        let x = col2X;
        x = drawCardTag(c.card_type, x, y2);
        x = drawQuarterTag(c.quarter, x, y2);
        doc.setTextColor(...COLORS.black);
        doc.text(`${c.match_minute}' - ${c.player_name}${c.dorsal ? ` #${c.dorsal}` : ''}`, x, y2);
        y2 += 12;
      });
    }
    
    y = Math.max(y, y2) + 10;
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
    
    y += 10;
    y = drawHorizontalBarChart(team1PenaltyGoals, team1PenaltyMiss, team2PenaltyGoals, team2PenaltyMiss, y);
    
    // Logos debajo
    const col1X = margin + 20;
    const col2X = pageWidth / 2 + 20;
    
    drawCircularLogo('team1', col1X, y, 12);
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(match.team1_name, col1X + 15, y + 8);
    
    drawCircularLogo('team2', col2X, y, 12);
    doc.text(match.team2_name, col2X + 15, y + 8);
    
    y += 25;
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
    
    y += 10;
    y = drawHorizontalBarChart(0, team1Strokes, 0, team2Strokes, y);
    
    // Logos debajo
    const col1X = margin + 20;
    const col2X = pageWidth / 2 + 20;
    
    drawCircularLogo('team1', col1X, y, 12);
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(match.team1_name, col1X + 15, y + 8);
    
    drawCircularLogo('team2', col2X, y, 12);
    doc.text(match.team2_name, col2X + 15, y + 8);
    
    y += 25;
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
    
    const col1X = margin + 20;
    const col2X = pageWidth / 2 + 20;
    
    drawCircularLogo('team1', col1X, y, 12);
    doc.setTextColor(...COLORS.black);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${match.team1_name}: ${team1Goals}`, col1X + 15, y + 8);
    
    drawCircularLogo('team2', col2X, y, 12);
    doc.text(`${match.team2_name}: ${team2Goals}`, col2X + 15, y + 8);
    
    y += 20;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    shootouts.forEach((s, idx) => {
      const result = s.scored ? 'Gol' : 'Fallado';
      const colX = s.team === 'team1' ? col1X : col2X;
      doc.text(`${idx + 1}. ${s.player_name}${s.dorsal ? ` #${s.dorsal}` : ''} - ${result}`, colX, y);
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
