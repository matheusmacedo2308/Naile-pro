const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// Add imports
code = code.replace(
  'import { useState } from "react";',
  'import { useState, useEffect } from "react";\nimport { projectId, publicAnonKey } from "../../utils/supabase/info";'
);

// Add state variables inside App
code = code.replace(
  '  const [activeCategory, setActiveCategory] = useState(0);',
  '  const [activeCategory, setActiveCategory] = useState(0);\n' +
  '  const [myAppointments, setMyAppointments] = useState<any[]>([]);\n' +
  '  const [isSubmitting, setIsSubmitting] = useState(false);\n' +
  '  const [error, setError] = useState<string | null>(null);\n' +
  '  const [loadingAppts, setLoadingAppts] = useState(false);\n'
);

// Add fetch function inside App
code = code.replace(
  '  const today = new Date();',
  '  const today = new Date();\n\n' +
  '  const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a3611da8/appointments`;\n\n' +
  '  useEffect(() => {\n' +
  '    if (activeTab === "appointments" || activeTab === "book") {\n' +
  '      fetchAppointments();\n' +
  '    }\n' +
  '  }, [activeTab]);\n\n' +
  '  const fetchAppointments = async () => {\n' +
  '    try {\n' +
  '      setLoadingAppts(true);\n' +
  '      const res = await fetch(API_URL, {\n' +
  '        headers: { Authorization: `Bearer ${publicAnonKey}` }\n' +
  '      });\n' +
  '      const data = await res.json();\n' +
  '      if (data.appointments) setMyAppointments(data.appointments);\n' +
  '    } catch (err) {\n' +
  '      console.error(err);\n' +
  '    } finally {\n' +
  '      setLoadingAppts(false);\n' +
  '    }\n' +
  '  };\n\n' +
  '  const handleConfirm = async () => {\n' +
  '    setIsSubmitting(true);\n' +
  '    setError(null);\n' +
  '    try {\n' +
  '      const res = await fetch(API_URL, {\n' +
  '        method: "POST",\n' +
  '        headers: {\n' +
  '          "Content-Type": "application/json",\n' +
  '          Authorization: `Bearer ${publicAnonKey}`\n' +
  '        },\n' +
  '        body: JSON.stringify(booking)\n' +
  '      });\n' +
  '      const data = await res.json();\n' +
  '      if (!res.ok) throw new Error(data.error || "Erro ao agendar.");\n' +
  '      \n' +
  '      setStep("success");\n' +
  '      fetchAppointments(); // Refresh the list\n' +
  '    } catch (err: any) {\n' +
  '      setError(err.message);\n' +
  '    } finally {\n' +
  '      setIsSubmitting(false);\n' +
  '    }\n' +
  '  };\n\n' +
  '  const isSlotBooked = (time: string) => {\n' +
  '    if (!booking.date || !booking.professional) return false;\n' +
  '    return myAppointments.some(a => \n' +
  '      a.professional.id === booking.professional?.id &&\n' +
  '      a.date.year === booking.date?.year &&\n' +
  '      a.date.month === booking.date?.month &&\n' +
  '      a.date.day === booking.date?.day &&\n' +
  '      a.time === time\n' +
  '    );\n' +
  '  };\n'
);

// Update time slot render
code = code.replace(
  '                        <button\n                          key={t}\n                          onClick={() => setBooking(b => ({ ...b, time: t }))}',
  '                        <button\n                          key={t}\n                          disabled={isSlotBooked(t)}\n                          onClick={() => setBooking(b => ({ ...b, time: t }))}'
);
code = code.replace(
  '                            background: booking.time === t ? "var(--primary)" : "var(--card)",\n                            color: booking.time === t ? "var(--primary-foreground)" : "var(--foreground)",\n                            borderColor: booking.time === t ? "var(--primary)" : "var(--border)",\n                            fontFamily: "\'DM Mono\', monospace",\n                            fontSize: "0.75rem",\n                          }}\n                        >\n                          {t}\n                        </button>',
  '                            background: booking.time === t ? "var(--primary)" : isSlotBooked(t) ? "var(--secondary)" : "var(--card)",\n                            color: booking.time === t ? "var(--primary-foreground)" : isSlotBooked(t) ? "var(--muted-foreground)" : "var(--foreground)",\n                            borderColor: booking.time === t ? "var(--primary)" : isSlotBooked(t) ? "transparent" : "var(--border)",\n                            opacity: isSlotBooked(t) ? 0.5 : 1,\n                            fontFamily: "\'DM Mono\', monospace",\n                            fontSize: "0.75rem",\n                          }}\n                        >\n                          {t}\n                        </button>'
);

// Update submit button
code = code.replace(
  '                <button\n                  onClick={() => setStep("success")}\n                  className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90"\n                  style={{ background: "var(--primary)" }}\n                >\n                  Confirmar Agendamento\n                </button>',
  '                {error && (\n                  <div className="mb-4 p-3 rounded-sm bg-red-50 border border-red-200 text-red-600 text-sm">\n                    {error}\n                  </div>\n                )}\n                <button\n                  onClick={handleConfirm}\n                  disabled={isSubmitting}\n                  className="w-full py-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"\n                  style={{ background: "var(--primary)" }}\n                >\n                  {isSubmitting ? "Confirmando..." : "Confirmar Agendamento"}\n                </button>'
);

// Update appointments tab
code = code.replace(
  '            <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Próximos</p>\n            <div className="space-y-3 mb-8">\n              {[\n                { service: "Manicure em Gel", professional: "Ana Luiza", date: "15/07/2026", time: "10:00", price: "R$ 120" },\n                { service: "Nail Art Básica", professional: "Camila Torres", date: "22/07/2026", time: "14:30", price: "R$ 35" },\n              ].map((appt, i) => (\n                <div key={i} className="bg-card border border-border rounded-sm p-4">\n                  <div className="flex justify-between items-start mb-3">\n                    <p className="font-medium text-foreground">{appt.service}</p>\n                    <span\n                      className="text-xs px-2 py-0.5 rounded-full"\n                      style={{ background: "var(--secondary)", color: "var(--primary)" }}\n                    >\n                      confirmado\n                    </span>\n                  </div>\n                  <div className="flex items-center gap-4 text-xs text-muted-foreground">\n                    <span>{appt.professional}</span>\n                    <span style={{ fontFamily: "\'DM Mono\', monospace" }}>{appt.date} · {appt.time}</span>\n                  </div>\n                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">\n                    <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>{appt.price}</span>\n                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">\n                      <X size={12} /> cancelar\n                    </button>\n                  </div>\n                </div>\n              ))}\n            </div>\n\n            {/* Past */}\n            <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Histórico</p>\n            <div className="space-y-3">\n              {[\n                { service: "Pedicure Spa", professional: "Fernanda Dias", date: "02/06/2026", time: "11:00", price: "R$ 95" },\n                { service: "Hidratação Profunda", professional: "Ana Luiza", date: "15/05/2026", time: "15:00", price: "R$ 55" },\n                { service: "Manicure Simples", professional: "Fernanda Dias", date: "30/04/2026", time: "09:30", price: "R$ 45" },\n              ].map((appt, i) => (',
  '            {loadingAppts ? (\n              <div className="py-10 text-center text-muted-foreground text-sm">Carregando agendamentos...</div>\n            ) : (\n              <>\n                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Próximos</p>\n                <div className="space-y-3 mb-8">\n                  {myAppointments.length === 0 ? (\n                    <div className="py-4 text-sm text-muted-foreground text-center">Nenhum agendamento encontrado.</div>\n                  ) : myAppointments.map((appt, i) => (\n                    <div key={i} className="bg-card border border-border rounded-sm p-4">\n                      <div className="flex justify-between items-start mb-3">\n                        <p className="font-medium text-foreground">{appt.service.name}</p>\n                        <span\n                          className="text-xs px-2 py-0.5 rounded-full"\n                          style={{ background: "var(--secondary)", color: "var(--primary)" }}\n                        >\n                          {appt.status}\n                        </span>\n                      </div>\n                      <div className="flex items-center gap-4 text-xs text-muted-foreground">\n                        <span>{appt.professional.name}</span>\n                        <span style={{ fontFamily: "\'DM Mono\', monospace" }}>{`${String(appt.date.day).padStart(2, "0")}/${String(appt.date.month + 1).padStart(2, "0")}/${appt.date.year}`} · {appt.time}</span>\n                      </div>\n                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">\n                        <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>{appt.service.price}</span>\n                        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">\n                          <X size={12} /> cancelar\n                        </button>\n                      </div>\n                    </div>\n                  ))}\n                </div>\n\n                {/* Past */}\n                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Histórico</p>\n                <div className="space-y-3">\n                  {[\n                    { service: { name: "Pedicure Spa", price: "R$ 95" }, professional: { name: "Fernanda Dias" }, date: { day: 2, month: 5, year: 2026 }, time: "11:00" },\n                    { service: { name: "Hidratação Profunda", price: "R$ 55" }, professional: { name: "Ana Luiza" }, date: { day: 15, month: 4, year: 2026 }, time: "15:00" },\n                    { service: { name: "Manicure Simples", price: "R$ 45" }, professional: { name: "Fernanda Dias" }, date: { day: 30, month: 3, year: 2026 }, time: "09:30" },\n                  ].map((appt, i) => ('
);

fs.writeFileSync('src/app/App.tsx', code);
