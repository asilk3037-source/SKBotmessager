export default function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <table aria-hidden="true">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: columns }).map((_col, c) => (
              <td key={c}>
                <div className="skeleton skeleton-text" style={{ width: `${60 + ((r + c) % 3) * 12}%` }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
