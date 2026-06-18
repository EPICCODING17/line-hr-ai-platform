type LiffFlow = "leave" | "ot" | "document" | "checkin";

type EmployeeLite = {
  firstName: string;
  lastName: string;
  code: string;
} | null;

const FLOW_LABEL: Record<LiffFlow, string> = {
  leave: "Leave",
  ot: "Overtime",
  document: "Documents",
  checkin: "Time clock",
};

const FLOW_TONE: Record<LiffFlow, string> = {
  leave: "#3c8cf3",
  ot: "#745af2",
  document: "#05be8a",
  checkin: "#05be8a",
};

export function LiffHero({
  flow,
  employee,
  title,
  sub,
}: {
  flow: LiffFlow;
  employee: EmployeeLite;
  title: string;
  sub: string;
}) {
  return (
    <header className={`liff-head liff-head--${flow}`} style={{ ["--flow-c" as string]: FLOW_TONE[flow] }}>
      {employee && (
        <div className="liff-greet">
          <span className="liff-avatar" aria-hidden>{initials(employee.firstName, employee.lastName)}</span>
          <span className="liff-greet-text">
            <span className="liff-hi">สวัสดีคุณ{employee.firstName}</span>
            <span className="liff-code">{employee.code}</span>
          </span>
          <span className="liff-live" aria-label="พร้อมใช้งาน">
            <span aria-hidden />
            พร้อม
          </span>
        </div>
      )}

      <div className="liff-hero">
        <div className="liff-hero-copy">
          <span className="liff-kicker">{FLOW_LABEL[flow]}</span>
          <h1 className="liff-title">{title}</h1>
          <p className="liff-sub">{sub}</p>
        </div>
        <div className="liff-mascot-wrap" aria-hidden>
          <span className="liff-spark s1" />
          <span className="liff-spark s2" />
          <img
            className="liff-mascot"
            src="/brand/hr-mascot-sm.webp"
            width="128"
            height="128"
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </div>
    </header>
  );
}

function initials(first: string, last: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).trim() || "?";
}
