// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Recharts necesita medir el contenedor; jsdom no tiene layout.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }
})

import LandingFunnelChart from '@/components/admin/charts/LandingFunnelChart'
import LandingTrafficChart from '@/components/admin/charts/LandingTrafficChart'
import type { FunnelStep, TrafficDay } from '@/utils/admin/landing-queries'

const FUNNEL: FunnelStep[] = [
  { path: '/', label: 'Inicio', visitors: 1240, dropFromPrev: null },
  { path: '/curso-bachatango', label: 'Página de venta', visitors: 223, dropFromPrev: 17.98 },
  { path: '/curso-bachatango/comprar', label: 'Formulario de compra', visitors: 27, dropFromPrev: 12.1 },
  { path: '/gracias', label: 'Compra completada', visitors: 17, dropFromPrev: 63.0 },
]

const TRAFFIC: TrafficDay[] = [
  { date: '2026-08-10', views: 120, uniques: 84 },
  { date: '2026-08-11', views: 96, uniques: 71 },
]

describe('LandingFunnelChart', () => {
  it('muestra los cuatro pasos con sus cifras', () => {
    render(<LandingFunnelChart data={FUNNEL} />)
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Compra completada')).toBeInTheDocument()
    // es-ES no pone separador de millar en 4 cifras: 1240, no 1.240.
    expect(screen.getByText('1240')).toBeInTheDocument()
  })

  it('muestra el porcentaje de paso, salvo en el primero', () => {
    render(<LandingFunnelChart data={FUNNEL} />)
    expect(screen.getByText(/18,0\s*%/)).toBeInTheDocument()
    expect(screen.getByText(/12,1\s*%/)).toBeInTheDocument()
  })

  it('advierte de que son proporciones, no recorridos', () => {
    render(<LandingFunnelChart data={FUNNEL} />)
    expect(screen.getByText(/no recorridos seguidos|proporciones/i)).toBeInTheDocument()
  })

  it('muestra el estado vacío sin datos', () => {
    render(<LandingFunnelChart data={FUNNEL.map(s => ({ ...s, visitors: 0 }))} />)
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument()
  })
})

// Con los anuncios entra más gente directa a la landing que por la home: el
// segundo paso tiene más visitas que el primero. Con el ancho calculado sobre
// el primero, la barra medía un 183 % y se salía de la tarjeta, y el panel
// enseñaba porcentajes de paso que no significan nada.
describe('LandingFunnelChart · entradas directas', () => {
  const ANUNCIOS: FunnelStep[] = [
    { path: '/', label: 'Inicio', visitors: 213, dropFromPrev: null },
    { path: '/curso-bachatango', label: 'Página de venta', visitors: 390, dropFromPrev: 183.1 },
    { path: '/curso-bachatango/comprar', label: 'Formulario de compra', visitors: 60, dropFromPrev: 15.4 },
    { path: '/curso-bachatango/comprar/enviado', label: 'Formulario enviado', visitors: 3, dropFromPrev: 5 },
    { path: '/gracias', label: 'Compra completada', visitors: 8, dropFromPrev: 266.7 },
  ]

  it('ninguna barra pasa del 100 % y la más ancha es la del paso con más visitas', () => {
    const { container } = render(<LandingFunnelChart data={ANUNCIOS} />)
    const anchos = [...container.querySelectorAll<HTMLElement>('[data-funnel-bar]')].map((b) => parseFloat(b.style.width))
    expect(Math.max(...anchos)).toBe(100)
    expect(anchos[1]).toBe(100)
    expect(anchos.every((a) => a > 0 && a <= 100)).toBe(true)
  })

  it('no enseña porcentajes de paso por encima del 100 %', () => {
    render(<LandingFunnelChart data={ANUNCIOS} />)
    expect(screen.queryByText(/183,1/)).toBeNull()
    expect(screen.queryByText(/266,7/)).toBeNull()
    expect(screen.getAllByText(/más que en el paso anterior/)).toHaveLength(2)
    // Los que sí tienen sentido se siguen enseñando.
    expect(screen.getByText(/15,4\s*%/)).toBeInTheDocument()
  })

  it('la conversión total se calcula sobre el paso con más visitas, y lo dice', () => {
    render(<LandingFunnelChart data={ANUNCIOS} />)
    // 8 compras / 390 visitas a la página de venta = 2,1 %
    expect(screen.getByText('Conversión total 2,1 % (compras / Página de venta)')).toBeInTheDocument()
  })
})

describe('LandingTrafficChart', () => {
  it('renderiza con datos', () => {
    render(<LandingTrafficChart data={TRAFFIC} />)
    expect(screen.getByText(/tráfico/i)).toBeInTheDocument()
  })

  it('muestra el estado vacío sin datos', () => {
    render(<LandingTrafficChart data={[]} />)
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument()
  })
})
