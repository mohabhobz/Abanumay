/** App background — a single continuous mesh gradient plus light grain. */
export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <span className="mesh" />
      <span className="grd" />
      <span className="grain" />
    </div>
  )
}
