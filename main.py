from textual.app import App
from screens import LoginScreen
from database import init_db

class POSApp(App):
    CSS_PATH = "styles.css"
    
    def on_mount(self):
        self.user = None       # will hold logged-in user data
        self.push_screen(LoginScreen())

if __name__ == "__main__":
    init_db()       # creates DB and default users
    POSApp().run()
