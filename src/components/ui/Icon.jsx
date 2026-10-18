import { icons } from '../../assets'

export default function Icon({ name, size = 20, alt = '', className = '' }) {
  return (
    <img
      src={icons[name]}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
