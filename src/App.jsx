import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Services from './components/Services'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import { useState } from 'react'

export default function App() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f9d6d1] to-white">
      <Navbar onBook={() => setOpen(true)} />
      <Hero onBook={() => setOpen(true)} />
      <Services />
      <Footer />
      <BookingModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
