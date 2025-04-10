import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaMoon, FaSun, FaBars, FaTimes } from 'react-icons/fa'
import styles from './Header.module.css'

const Header = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      window.scrollY > 10 ? setScrolled(true) : setScrolled(false)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'About', href: '#about' },
    { name: 'Skills', href: '#skills' },
    { name: 'Projects', href: '#projects' },
    { name: 'Contact', href: '#contact' }
  ]

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className="container">
        <nav className={styles.navbar}>
          <a href="#" className={styles.logo}>Samuel Kasper</a>
          
          <ul className={styles.navLinks}>
            {navLinks.map((link) => (
              <li key={link.name}>
                <a 
                  href={link.href}
                  className={styles.navLink}
                >
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
          
          <div className={styles.navControls}>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={styles.themeToggle}
            >
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
            
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className={styles.mobileMenuBtn}
            >
              {isOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        </nav>
        
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.mobileMenu}
          >
            <nav className={styles.mobileNav}>
              {navLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={styles.mobileNavLink}
                >
                  {link.name}
                </a>
              ))}
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  )
}

export default Header