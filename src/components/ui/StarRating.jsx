import { icons } from '../../assets'

export default function StarRating({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-3" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const selected = star <= value
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={selected && star === value}
            aria-label={`${label} ${star}`}
            onClick={() => onChange(star)}
            className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <img
              src={selected ? icons.star : icons.starEmpty}
              alt=""
              width={32}
              height={32}
              style={{ width: 32, height: 32 }}
            />
          </button>
        )
      })}
    </div>
  )
}
