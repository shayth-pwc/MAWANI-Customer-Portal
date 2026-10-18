export default function PageContainer({ children, className = '', alignStart = false }) {
  return (
    <div className={`flex w-full flex-col gap-8 px-4 pb-12 md:px-8 ${alignStart ? '' : 'mx-auto max-w-[1372px]'} ${className}`}>
      {children}
    </div>
  )
}
