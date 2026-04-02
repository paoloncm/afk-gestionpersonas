
  kpis: { candidates: 2184, hires: 124, jobs: 327, interviews: 4485, hireDelta: +35.6, intDelta: -8.2 },
  applicantsByMonth: [8,13,18,22,27,21,34,47,50],
  timeToHire: [12,21,30,19,28,17,18,16,20],
  sources: [
    { name: "Linkedin", v: 605, kind: "linkedin" },
    { name: "Website", v: 556, kind: "web" },
    { name: "Indeed", v: 196, kind: "indeed" },
    { name: "Employee Referral", v: 148 },
    { name: "Talent Fair", v: 142 }
  ],
  candidates: [
    { id: 1, name: "Carlos Prieto", title: "Técnico Electricista", source: "Linkedin", status: "Interviewing", email:"cprieto@email.com", phone:"+56 9 4567 5800" },
    { id: 2, name: "Andrea Ríos", title: "Frontend", source: "Referral", status: "Active" },
    { id: 3, name: "John Crison", title: "UI/UX Designer", source: "Linkedin", status: "Active" },
    { id: 4, name: "Diego Labpara", title: "Sales Associate", source: "Indeed", status: "Hired" }
  ],
  vacancies: [
    { id: 101, title: "Técnico de Mantenimiento", city: "Antofagasta", days: 18, status:"Procesando",
      reqs: ["3 años de experiencia", "Certificación en mantención", "Turnos rotativos"],
      pipeline: { applied: 17, screening: 6, interview: 4 }
    },
    { id: 102, title: "Técnico Eléctrico", city: "Santiago", days: 30, status:"Activa",
      reqs: ["Mantención industrial", "Circuitos eléctricos", "Curso en seguridad eléctrica"],
      pipeline: { applied: 28, screening: 6, interview: 4 }
    }
  ],
  alerts: [
    { emp:"Gonzalo Lopez", type:"Licencia de conducir", due:"23. abr 2023", state:"Warning", severity:"Media" },
    { emp:"Jessica Nunez", type:"ISO 9001",           due:"3. may. 2023",  state:"Activo",  severity:"Alta"  },
    { emp:"Valeria Silva",  type:"Licencia conducir", due:"15. may. 2023", state:"Inactivo",severity:"Alta"  },
    { emp:"Tomas Salgado",  type:"PRL",               due:"7. jun. 2023",  state:"—",       severity:"Baja"  },
    { emp:"Martin Soto",    type:"Licencia conducir", due:"26. jun. 2023", state:"—",       severity:"Baja"  },
    { emp:"Igula Torres",   type:"ISO 9001",          due:"13. jul. 2023", state:"—",       severity:"Baja"  }
  ],
  interviewsWeek: [
    { day:"Lunes",  at:"10:00", who:"Annah",  role:"Backend",   color:"red" },
    { day:"Martes", at:"13:00", who:"Ieslentne", role:"QA",    color:"red" },
    { day:"Miércoles", at:"11:00", who:"Andrean", role:"PM",   color:"gray" },
    { day:"Viernes", at:"11:00–12:20", who:"Andrea Rios", role:"Frontend", color:"gray" }
  ]
};
