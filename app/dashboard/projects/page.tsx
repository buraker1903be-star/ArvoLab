import { CalendarDays, Filter, Plus, Search, UserRound } from "lucide-react";

const projects = [
  {
    title: "Eğitim Bilimleri Yüksek Lisans Tezi",
    institution: "Marmara Üniversitesi",
    owner: "Ayşe Demir",
    status: "Yazım aşamasında",
    dueDate: "18 Ağustos 2026",
    progress: 64,
  },
  {
    title: "Sağlık Yönetimi Makalesi",
    institution: "Ankara Üniversitesi",
    owner: "Mehmet Kaya",
    status: "Analiz bekliyor",
    dueDate: "22 Ağustos 2026",
    progress: 42,
  },
  {
    title: "Psikoloji Doktora Tezi",
    institution: "İstanbul Üniversitesi",
    owner: "Selin Arslan",
    status: "Revizyonda",
    dueDate: "30 Ağustos 2026",
    progress: 81,
  },
];

export default function ProjectsPage() {
  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Akademik operasyon</span>
          <h1 className="brand-type">Akademik Çalışmalar</h1>
          <p>Tez, makale, proje ve analiz çalışmalarını tek merkezden yönetin.</p>
        </div>
        <button type="button" className="projects-primary-button">
          <Plus size={18} />
          Yeni çalışma
        </button>
      </section>

      <section className="projects-toolbar">
        <div className="projects-search">
          <Search size={17} />
          <input type="search" placeholder="Çalışma, kurum veya çalışan ara" />
        </div>
        <button type="button" className="projects-filter-button">
          <Filter size={17} />
          Filtrele
        </button>
      </section>

      <section className="projects-list" aria-label="Akademik çalışma listesi">
        {projects.map((project) => (
          <article className="project-card" key={project.title}>
            <div className="project-card-main">
              <div>
                <span className="project-status">{project.status}</span>
                <h2>{project.title}</h2>
                <p>{project.institution}</p>
              </div>
              <div className="project-progress" aria-label={`İlerleme yüzde ${project.progress}`}>
                <strong>%{project.progress}</strong>
                <div className="project-progress-track">
                  <span style={{ width: `${project.progress}%` }} />
                </div>
              </div>
            </div>

            <div className="project-card-meta">
              <span>
                <UserRound size={15} />
                {project.owner}
              </span>
              <span>
                <CalendarDays size={15} />
                {project.dueDate}
              </span>
              <button type="button">Çalışmayı aç</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
