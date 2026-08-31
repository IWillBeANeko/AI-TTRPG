export default function PersonalityReport({ report, onBack }) {
  if (!report) return null;
  return (
    <section className="boot companion-brief-stage" aria-label="性格测评">
      <article className="brief-card assess-card">
        <p className="sub">TIDE REQUIEM · 性格测评</p>
        <h1>{report.headline}</h1>
        <div className="companion-brief">
          <p>{report.opening}</p>
          <div className="assess-item">
            <b>对人</b>
            <p>{report.with_people}</p>
          </div>
          <div className="assess-item">
            <b>压力下</b>
            <p>{report.under_pressure}</p>
          </div>
          <div className="assess-item">
            <b>查案方式</b>
            <p>{report.method}</p>
          </div>
          <div className="assess-item">
            <b>结论</b>
            <p>{report.verdict}</p>
          </div>
        </div>
        <p className="tiny">以上只根据这一局里你做过的事和说过的话。记录里没有的，不会写成你做了。</p>
        <button className="tide-btn gold" type="button" onClick={onBack}>
          返回
        </button>
      </article>
    </section>
  );
}
