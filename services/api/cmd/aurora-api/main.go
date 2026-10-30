package main

import (
  "log"
  "net/http"
  "os"
  "time"

  "github.com/fabriciomatosqa/AURORA-LIVES/services/api/internal/server"
)

func main() {
  address := "127.0.0.1:8787"
  if v := os.Getenv("AURORA_LISTEN"); v != "" { address = v }
  log.Printf("AURORA LIVES development API listening on %s (no authentication; do not expose publicly)", address)
  app := server.New()
  httpServer := &http.Server{
    Addr: address,
    Handler: app.Handler(),
    ReadHeaderTimeout: 5 * time.Second,
  }
  log.Fatal(httpServer.ListenAndServe())
}
