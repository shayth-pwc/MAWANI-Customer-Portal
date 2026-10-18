import { icons, images } from '../../assets'

export default function Avatar({ size = 40, badge = true }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <img
        src={images.avatar}
        alt=""
        width={size}
        height={size}
        className="rounded-full border border-black/10 object-cover"
        style={{ width: size, height: size }}
      />
      {badge ? (
        <span className="absolute -bottom-0.5 -end-0.5 flex size-3.5 items-center justify-center rounded-full border-[1.5px] border-white bg-brand-400">
          <img src={icons.buildingSolid} alt="" width={9} height={9} style={{ width: 9, height: 9 }} />
        </span>
      ) : null}
    </span>
  )
}
