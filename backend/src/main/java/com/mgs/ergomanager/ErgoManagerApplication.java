package com.mgs.ergomanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point of the ErgoManager REST API.
 */
@SpringBootApplication
public class ErgoManagerApplication {

    /**
     * Starts the Spring Boot application.
     *
     * @param args arguments received from the command line
     */
    public static void main(String[] args) {
        SpringApplication.run(ErgoManagerApplication.class, args);
    }
}
