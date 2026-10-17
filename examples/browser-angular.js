import { Component } from '@angular/core'
import { app, useRouter } from './useRouter-angular'

// --- ROUTE DEFINITIONS ---
app.get('/', () => '🏠 Home View')
app.get('/about', () => 'ℹ️ About View')
app.get('/user/:id', (req) => `👤 User: ${req.params.id}`)

// Guard Middleware
app.use('/admin', (req, res, next) => {
  const isLoggedOut = true
  return isLoggedOut ? '🔒 403 Forbidden' : next()
})
app.get('/admin/dashboard', () => 'Admin Area')

// --- MAIN COMPONENT ---
@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div (click)="handleLinkClick($event)" style="display: flex; gap: 20px;">
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a> | <a href="/user/99">User 99</a> | <a href="/admin/dashboard">Admin</a>
      </nav>
      <main>{{ view() }}</main>
    </div>
  `
})
export class AppComponent {
  router = useRouter('Loading...')
  view = this.router[0]
  handleLinkClick = this.router[1].onClick
}
