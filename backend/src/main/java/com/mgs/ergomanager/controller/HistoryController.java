package com.mgs.ergomanager.controller;

import com.mgs.ergomanager.dto.history.HistoryResponseDTO;
import com.mgs.ergomanager.service.HistoryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read only endpoints of the evaluation history.
 */
@RestController
@RequestMapping("/api/histories")
@Tag(name = "History", description = "Evaluation history of the companies and their employees")
public class HistoryController {

    private final HistoryService historyService;

    /**
     * Builds the controller with its service.
     *
     * @param historyService service that reads the history
     */
    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    /**
     * Returns the history entries of a client company, newest first.
     *
     * @param companyId identifier of the company
     * @return list of history entries
     */
    @GetMapping
    public ResponseEntity<List<HistoryResponseDTO>> findByCompany(@RequestParam Long companyId) {
        return ResponseEntity.ok(historyService.findByCompany(companyId));
    }

    /**
     * Returns the history entries of an employee, newest first.
     *
     * @param employeeEmail email of the employee
     * @return list of history entries
     */
    @GetMapping("/employees/{employeeEmail}")
    public ResponseEntity<List<HistoryResponseDTO>> findByEmployee(@PathVariable String employeeEmail) {
        return ResponseEntity.ok(historyService.findByEmployee(employeeEmail));
    }
}
