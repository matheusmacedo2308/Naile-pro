export const formatPhoneForWhatsapp = (phone: string): string => {
  // Remove tudo que não for número
  const cleaned = phone.replace(/\D/g, '');
  
  // Se o usuário não digitou o código do país (55), adiciona automaticamente
  if (cleaned.length === 11 || cleaned.length === 10) {
    return `55${cleaned}`;
  }
  
  return cleaned;
};