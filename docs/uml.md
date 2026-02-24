# UML Diagrams

## Use Case Diagram
Actors: Administrator, Students, End Users, Security Teams
Use cases: Scan URL, Scan Email, Scan Image, Scan File, View Reports, Manage Users

## Class Diagram (High level)
- ScannerService
- ModelService
- ScanRepository
- User
- Report

## Sequence Diagram (URL scan)
User -> Dashboard -> API -> ModelService -> Repository -> Dashboard
