-- Eliminar políticas existentes de lotteries
DROP POLICY IF EXISTS "Any user can view lotteries" ON lotteries;
DROP POLICY IF EXISTS "Admins can insert lotteries" ON lotteries;
DROP POLICY IF EXISTS "Admins can update lotteries" ON lotteries;
DROP POLICY IF EXISTS "Admins can delete lotteries" ON lotteries;

-- Nuevas políticas RLS para lotteries (sin requerir autenticación)
CREATE POLICY "Any user can view lotteries" ON lotteries FOR SELECT USING (true);
CREATE POLICY "Any user can insert lotteries" ON lotteries FOR INSERT WITH CHECK (true);
CREATE POLICY "Any user can update lotteries" ON lotteries FOR UPDATE USING (true);
CREATE POLICY "Any user can delete lotteries" ON lotteries FOR DELETE USING (true);
