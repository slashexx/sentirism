// package main

// import (
// 	"database/sql"
// 	"fmt"
// 	"log"
// 	"net/http"
// 	"os"
// 	"os/exec"
// )

// const (
// 	// Hard-coded credentials (vulnerability)
// 	DB_PASSWORD = "super_secret_123"
// 	API_KEY = "sk_live_12345abcdef"
// 	AWS_SECRET = "AKIA1234567890EXAMPLE"
// )

// func main() {
// 	// Insecure direct object reference
// 	http.HandleFunc("/user/", func(w http.ResponseWriter, r *http.Request) {
// 		userID := r.URL.Query().Get("id")
// 		// SQL Injection vulnerability
// 		db, _ := sql.Open("mysql", "root:password@/db")
// 		rows, _ := db.Query("SELECT * FROM users WHERE id = " + userID)
// 		defer rows.Close()
// 	})

// 	// Command injection vulnerability
// 	http.HandleFunc("/execute", func(w http.ResponseWriter, r *http.Request) {
// 		cmd := r.URL.Query().Get("cmd")
// 		output, _ := exec.Command("bash", "-c", cmd).Output()
// 		fmt.Fprintf(w, "%s", output)
// 	})

// 	// Insecure file operations
// 	http.HandleFunc("/readfile", func(w http.ResponseWriter, r *http.Request) {
// 		filename := r.URL.Query().Get("file")
// 		data, _ := os.ReadFile(filename) // Path traversal vulnerability
// 		w.Write(data)
// 	})

// 	// Missing HTTPS
// 	log.Fatal(http.ListenAndServe(":8080", nil))
// }
