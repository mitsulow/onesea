/** プロっぽい線画のカメラアイコン（📷絵文字の置き換え用） */
export function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h3l1.5-2.2A1 1 0 0 1 9.3 4.4h5.4a1 1 0 0 1 .8.4L17 7h3a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V8.5A1.5 1.5 0 0 1 4 7Z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}
